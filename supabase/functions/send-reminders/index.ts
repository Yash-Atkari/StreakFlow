import { createClient } from 'npm:@supabase/supabase-js@2'
import { initializeApp, cert } from 'npm:firebase-admin/app'
import { getMessaging } from 'npm:firebase-admin/messaging'

// 1. Load the Firebase Service Account Secret
const serviceAccountEnv = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY');
if (!serviceAccountEnv) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY secret');
}

// 2. Initialize Firebase Admin
const serviceAccount = JSON.parse(serviceAccountEnv);
const firebaseApp = initializeApp({
  credential: cert(serviceAccount)
});

// 3. Initialize Supabase Admin Client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  try {
    // Debug: Fetch all registered tokens
    const { data: allTokens } = await supabase.from('fcm_tokens').select('*');

    // 4. Fetch targeted active reminders from database via RPC
    const { data: reminders, error } = await supabase.rpc('get_active_reminders');

    if (error) throw error;
    
    // If no reminders are due now, exit gracefully
    if (!reminders || reminders.length === 0) {
      console.log("No targeted reminders found. Total notifications sent: 0");
      return new Response(
        JSON.stringify({ sent: 0 }), 
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. Prepare custom notification message payloads
    const messages = reminders.map((r: any) => ({
      notification: {
        title: r.title,
        body: r.body,
      },
      webpush: {
        notification: {
          title: r.title,
          body: r.body,
          icon: 'https://streak-flow.netlify.app/logo192.png',
          badge: 'https://streak-flow.netlify.app/badge-flame.png',
        }
      },
      token: r.token,
    }));

    // 6. Send the custom notifications in batch via Firebase
    const response = await getMessaging(firebaseApp).sendEach(messages);
    
    console.log(`Successfully sent ${response.successCount} custom messages.`);

    // 7. Track successful dispatches to update last_notified_at cache in database
    const sentRitualIds: string[] = [];
    const details: any[] = [];
    response.responses.forEach((res: any, index: number) => {
      const fullToken = reminders[index].token;
      const tokenPreview = fullToken.length > 20 
        ? `${fullToken.substring(0, 10)}...${fullToken.substring(fullToken.length - 10)}` 
        : fullToken;
        
      if (res.success) {
        sentRitualIds.push(reminders[index].ritual_id);
        details.push({ token: tokenPreview, status: 'success' });
      } else {
        console.warn(`Failed to send to token: ${reminders[index].token}. Error:`, res.error?.message);
        details.push({ token: tokenPreview, status: 'failed', error: res.error?.message });
      }
    });

    if (sentRitualIds.length > 0) {
      const { error: markError } = await supabase.rpc('mark_rituals_notified', {
        ritual_ids_param: sentRitualIds
      });
      if (markError) {
        console.error("Error marking rituals notified:", markError.message);
      }
    }

    return new Response(
      JSON.stringify({ 
        sent: response.successCount, 
        failures: response.failureCount,
        details: details,
        allTokens: allTokens
      }), 
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err) {
    console.error("Function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

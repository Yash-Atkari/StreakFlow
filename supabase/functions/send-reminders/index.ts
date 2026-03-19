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
// Supabase automatically provides the URL and SERVICE_ROLE_KEY in the background!
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  try {
    // 4. Fetch all active device tokens from your database
    const { data: tokens, error } = await supabase.from('fcm_tokens').select('token');

    if (error) throw error;
    
    // If no tokens exist, exit gracefully
    if (!tokens || tokens.length === 0) {
      console.log("No tokens found. Total notifications sent: 0");
      return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 5. Prepare the notification payload
    const registrationTokens = tokens.map(t => t.token);
    const message = {
      notification: {
        title: '🔥 StreakFlow Reminder',
        body: 'Time to complete your daily habits and keep your streak alive!',
      },
      tokens: registrationTokens,
    };

    // 6. Send the push notifications via Firebase
    const response = await getMessaging(firebaseApp).sendEachForMulticast(message);
    
    console.log(`Successfully sent ${response.successCount} messages.`);

    return new Response(
      JSON.stringify({ sent: response.successCount, failures: response.failureCount }), 
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err) {
    console.error("Function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

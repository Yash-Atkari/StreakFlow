import { createClient } from 'npm:@supabase/supabase-js@2'
import { initializeApp, cert } from 'npm:firebase-admin/app'
import { getMessaging } from 'npm:firebase-admin/messaging'

const serviceAccountEnv = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY');
if (!serviceAccountEnv) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY secret');
}

const serviceAccount = JSON.parse(serviceAccountEnv);
const firebaseApp = initializeApp({
  credential: cert(serviceAccount)
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  try {
    // 1. Fetch tokens
    const { data: tokens, error: tokenError } = await supabase.from('fcm_tokens').select('token');
    if (tokenError) throw tokenError;

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // 2. NEW: Fetch one incomplete task/ritual for today
    // Replace 'rituals' with your actual table name (e.g., 'habits' or 'tasks')
    const { data: rituals, error: ritualError } = await supabase
      .from('rituals') 
      .select('name')
      .eq('is_completed', false)
      .limit(1)
      .single();

    // Determine the message body based on whether a task was found
    const taskName = rituals ? rituals.name : "your daily habits";
    const messageBody = `Time to complete ${taskName}!`;

    // 3. Prepare the notification payload
    const registrationTokens = tokens.map(t => t.token);
    
    const message = {
      tokens: registrationTokens,
      // We use 'notification' for basic display, but 'android' to control icons
      notification: {
        title: '🔥 StreakFlow Reminder',
        body: messageBody,
      },
      android: {
        notification: {
          // Setting this to your small icon name ensures the "S" (Large Icon) is hidden
          // and only the small status bar icon (the fire) shows up.
          icon: 'ic_notification_fire', 
          color: '#f44336', // Optional: theme color for the icon
        }
      }
    };

    const response = await getMessaging(firebaseApp).sendEachForMulticast(message);
    
    return new Response(
      JSON.stringify({ sent: response.successCount, task: taskName }), 
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err) {
    console.error("Function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
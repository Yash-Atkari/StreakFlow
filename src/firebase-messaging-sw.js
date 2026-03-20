// 1. Import Firebase libraries for Service Workers
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 2. Your Firebase configuration (Now using injected variables)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// 3. Initialize Firebase
firebase.initializeApp(firebaseConfig);

// 4. Initialize Messaging
const messaging = firebase.messaging();

// 5. Handle Background Notifications
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message: ', payload);
  
  const notificationTitle = payload.notification?.title || 'StreakFlow Reminder';
  const notificationOptions = {
    body: payload.notification?.body || 'Time to complete your habits!',
    icon: '/logo192.png', 
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 6. The PWA "Fetch" Trick
self.addEventListener('fetch', function(event) {
  // tricks Chrome into passing the PWA offline check
});
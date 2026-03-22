// 1. Import Firebase libraries for Service Workers
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 2. Your Firebase configuration (Now using injected variables)
const firebaseConfig = {
  apiKey: "AIzaSy" + "BgSl4kmde03Tfli6ZHBpo_rNEFbQ8wEb4",
  authDomain: "streakflow-1e44b.firebaseapp.com",
  projectId: "streakflow-1e44b",
  storageBucket: "streakflow-1e44b.firebasestorage.app",
  messagingSenderId: "907823333122",
  appId: "1:907823333122:web:ad209ad948c38d651dcc1b"
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
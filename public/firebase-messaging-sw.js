// 1. Import Firebase libraries for Service Workers
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 2. Your Firebase configuration (Removed Analytics)
const firebaseConfig = {
  apiKey: "AIzaSyAeDj9rruFAACp-w0rEDkMO5rLyzgz76mg",
  authDomain: "streakflow-df8d6.firebaseapp.com",
  projectId: "streakflow-df8d6",
  storageBucket: "streakflow-df8d6.firebasestorage.app",
  messagingSenderId: "342195661254",
  appId: "1:342195661254:web:309978004dd21a9bf7aac7"
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
    icon: '/logo192.png', // Uses the new flame icon you generated!
    // badge: '/favicon.svg' // The small monochrome icon for the Android status bar
  };

  // self.registration.showNotification(notificationTitle, notificationOptions);
});

// 6. The PWA "Fetch" Trick
self.addEventListener('fetch', function(event) {
  // Leave this blank, it tricks Chrome into passing the PWA offline check
});
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAeDj9rruFAACp-w0rEDkMO5rLyzgz76mg",
  authDomain: "streakflow-df8d6.firebaseapp.com",
  projectId: "streakflow-df8d6",
  storageBucket: "streakflow-df8d6.firebasestorage.app",
  messagingSenderId: "342195661254",
  appId: "1:342195661254:web:309978004dd21a9bf7aac7",
  measurementId: "G-WJND728V55"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

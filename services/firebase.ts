// Firebase Configuration and Initialization
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration (NEW PROJECT: UG-A)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAHdAvXANJDg-CtlLM2DuHDWo1c38H1QZg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ug-a-64252.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ug-a-64252",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ug-a-64252.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "66668419350",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:66668419350:web:319b793e25046f64571837",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-F6GXB091P9"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Analytics (optional, only in browser environment)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };

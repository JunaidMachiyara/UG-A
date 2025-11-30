// Firebase Configuration and Initialization
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration (NEW PROJECT: UG-A)
const firebaseConfig = {
  apiKey: "AIzaSyAHdAvXANJDg-CtlLM2DuHDWo1c38H1QZg",
  authDomain: "ug-a-64252.firebaseapp.com",
  projectId: "ug-a-64252",
  storageBucket: "ug-a-64252.firebasestorage.app",
  messagingSenderId: "66668419350",
  appId: "1:66668419350:web:319b793e25046f64571837",
  measurementId: "G-F6GXB091P9"
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

// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyAVr-IZTihG39_fXL4hLamtvfEMsw1c894",
  authDomain: "soultotable.firebaseapp.com",
  projectId: "soultotable",
  storageBucket: "soultotable.firebasestorage.app",
  messagingSenderId: "159182364603",
  appId: "1:159182364603:web:e5724ff15bcdeaaac3ae9e",
  measurementId: "G-YVLR6FZHKG"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize services
export const db = getFirestore(app);

// Initialize Analytics only on client side
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.error('Analytics initialization error:', error);
  }
}

export { analytics };
export default app;
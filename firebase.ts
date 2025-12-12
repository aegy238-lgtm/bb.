import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyB7z-5161J57yynvO7mtIM-pHjAHrwsM-I",
  authDomain: "svga-f7b49.firebaseapp.com",
  projectId: "svga-f7b49",
  storageBucket: "svga-f7b49.firebasestorage.app",
  messagingSenderId: "291354235514",
  appId: "1:291354235514:web:1ccb4549b818eeae8f21c3"
};

// Initialize Primary Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Secondary App (For creating users without logging out the admin)
const secondaryApp = !getApps().some(a => a.name === 'Secondary') 
  ? initializeApp(firebaseConfig, 'Secondary') 
  : getApp('Secondary');

// Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Export Secondary Auth for Admin User Creation
export const secondaryAuth = getAuth(secondaryApp);
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB7z-5161J57yynvO7mtIM-pHjAHrwsM-I",
  authDomain: "svga-f7b49.firebaseapp.com",
  projectId: "svga-f7b49",
  storageBucket: "svga-f7b49.firebasestorage.app",
  messagingSenderId: "291354235514",
  appId: "1:291354235514:web:1ccb4549b818eeae8f21c3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);
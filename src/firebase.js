// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- PASTE YOUR CONFIG KEYS HERE ---
const firebaseConfig = {
  apiKey: "AIzaSyANwkyWzLGl8KoWMKoBsGrjZ6FEcwyvGQM",
  authDomain: "capstone-d6595.firebaseapp.com",
  projectId: "capstone-d6595",
  storageBucket: "capstone-d6595.firebasestorage.app",
  messagingSenderId: "263003975385",
  appId: "1:263003975385:web:d7987746d62e025e29d8c8"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get references to the services we need
const db = getFirestore(app);
const auth = getAuth(app);

// Export them for use in other files
export { db, auth };
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";



const firebaseConfig = {
    apiKey: "AIzaSyAvymocB8adMv1Z4TJzfmD8aS0bB4bwrw8",
    authDomain: "itagts.firebaseapp.com",
    projectId: "itagts",
    storageBucket: "itagts.firebasestorage.app",
    messagingSenderId: "763913638158",
    appId: "1:763913638158:web:a959918d1940ca2aec475f",
    measurementId: "G-93Z6VMFT49"
  };

// ✅ Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ Correct export
export { db };

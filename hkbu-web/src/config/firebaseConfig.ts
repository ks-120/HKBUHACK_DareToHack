import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// 🔥 Replace with your Firebase project config
// Firebase Console → Project Settings → Your Apps → SDK setup & configuration
const firebaseConfig = {
    apiKey: "AIzaSyBbONhIOssX7Gj4kCfJukI-2hNfleLXy78",
    authDomain: "buhack-a71e2.firebaseapp.com",
    projectId: "buhack-a71e2",
    storageBucket: "buhack-a71e2.appspot.com",
    messagingSenderId: "812153039843",
    appId: "1:812153039843:web:e92232616ed46aae9e4ed6",
    measurementId: "G-89EE7E2MLE"
  };

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app

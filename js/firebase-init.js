import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = window.FIREBASE_CONFIG || {};
const hasPlaceholderConfig = !firebaseConfig.apiKey || !firebaseConfig.projectId || /demo|placeholder|example/i.test(String(firebaseConfig.apiKey)) || /demo|placeholder|example/i.test(String(firebaseConfig.projectId));

let app = null;
let auth = null;
let db = null;

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || hasPlaceholderConfig) {
  console.warn('Firebase config is missing or using placeholder values. Demo auth mode will be used.');
} else {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };

export function getCurrentUser() {
  return auth ? auth.currentUser : null;
}

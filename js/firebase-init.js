import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

let app = null;
let auth = null;
let db = null;

// Ensure runtime firebase config is loaded before initializing.
if (typeof window.loadFirebaseConfig === 'function') {
  // loadFirebaseConfig is async; wait for it then initialize if config is present.
  await window.loadFirebaseConfig();
}

const firebaseConfig = window.FIREBASE_CONFIG || {};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn('Firebase config was not loaded before initialization. Firebase features will be disabled.');
} else {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };

export function getCurrentUser() {
  return auth ? auth.currentUser : null;
}

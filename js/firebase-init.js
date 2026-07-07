import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = window.FIREBASE_CONFIG || {};

let app = null;
let auth = null;
let db = null;

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  // Do not throw: site should remain usable even when runtime config is not present.
  // Features that depend on Firebase will be no-ops until a valid config is provided.
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

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

let app = null;
let auth = null;
let db = null;

function hasPlaceholderConfig(value) {
  return !value || /demo|placeholder|example/i.test(String(value));
}

function initializeFirebase() {
  const firebaseConfig = window.FIREBASE_CONFIG || {};
  const configIsValid = firebaseConfig.apiKey && firebaseConfig.projectId && !hasPlaceholderConfig(firebaseConfig.apiKey) && !hasPlaceholderConfig(firebaseConfig.projectId);
  window.__firebaseInitState = { config: firebaseConfig, configIsValid, initialized: false };

  if (!configIsValid) {
    console.warn('Firebase config is missing or using placeholder values. Demo auth mode will be used.', firebaseConfig);
    return;
  }

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    window.__firebaseInitState.initialized = true;
    window.__firebaseAuthInitialized = true;
    console.debug('Firebase initialized successfully.', firebaseConfig.projectId);
  } catch (error) {
    window.__firebaseInitState.error = error && error.message ? error.message : String(error);
    console.error('Firebase initialization failed.', window.__firebaseInitState.error);
  }
}

let firebaseReady = Promise.resolve();

(async () => {
  if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.apiKey || !window.FIREBASE_CONFIG.projectId) {
    if (typeof window.loadFirebaseConfig === 'function') {
      await window.loadFirebaseConfig();
    }
  }
  initializeFirebase();
})();

export { app, auth, db, firebaseReady };

export function getCurrentUser() {
  return auth ? auth.currentUser : null;
}

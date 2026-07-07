import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

let app = null;
let auth = null;
let db = null;

const INLINE_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDXdPcqyWL6UPSFFT7nYdm90eELbpTj9DA',
  authDomain: 'silvertech-portal.firebaseapp.com',
  projectId: 'silvertech-portal',
  storageBucket: 'silvertech-portal.firebasestorage.app',
  messagingSenderId: '934278665675',
  appId: '1:934278665675:web:4c0a75d658346a6e34124e'
};

function hasPlaceholderConfig(value) {
  return !value || /demo|placeholder|example/i.test(String(value));
}

function initializeFirebase() {
  const firebaseConfig = window.FIREBASE_CONFIG || INLINE_FIREBASE_CONFIG;
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
    try {
      if (typeof window.loadFirebaseConfig === 'function') {
        await window.loadFirebaseConfig();
      }
    } catch (error) {
      console.warn('Firebase config loader failed; using inline fallback config.', error);
    }
  }
  initializeFirebase();
})();

export { app, auth, db, firebaseReady };

export function getCurrentUser() {
  return auth ? auth.currentUser : null;
}

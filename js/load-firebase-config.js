(function () {
  const fallbackConfig = {
    apiKey: 'AIzaSyDXdPcqyWL6UPSFFT7nYdm90eELbpTj9DA',
    authDomain: 'silvertech-portal.firebaseapp.com',
    projectId: 'silvertech-portal',
    storageBucket: 'silvertech-portal.firebasestorage.app',
    messagingSenderId: '934278665675',
    appId: '1:934278665675:web:4c0a75d658346a6e34124e'
  };

  function loadConfig() {
    if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.apiKey || !window.FIREBASE_CONFIG.projectId) {
      window.FIREBASE_CONFIG = fallbackConfig;
    }

    return window.FIREBASE_CONFIG;
  }

  window.loadFirebaseConfig = loadConfig;
  loadConfig();
})();

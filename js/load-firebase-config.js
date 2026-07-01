(function () {
  function getRepoBase() {
    try {
      const scriptUrl = document.currentScript && document.currentScript.src;
      if (!scriptUrl) {
        return '';
      }

      const pathname = new URL(scriptUrl).pathname;
      const idx = pathname.indexOf('/js/');
      return idx !== -1 ? pathname.substring(0, idx) : '';
    } catch (error) {
      return '';
    }
  }

  function buildCandidateUrls() {
    const repoBase = getRepoBase();
    const candidates = [];
    const origin = window.location.origin;

    if (repoBase) {
      candidates.push(`${origin}${repoBase}/firebase-config.js`);
    }

    candidates.push(`${origin}/firebase-config.js`);
    // Try raw GitHub URLs for the repo under the current owner's account as a fallback.
    // Updated to use the current GitHub username 'Silvertechelectrical'.
    candidates.push('https://raw.githubusercontent.com/Silvertechelectrical/silvertech-website/gh-pages/firebase-config.js');
    candidates.push('https://raw.githubusercontent.com/Silvertechelectrical/silvertech-website/main/firebase-config.js');

    return [...new Set(candidates)];
  }

  function loadConfigFromUrl(url) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);

    if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
      const script = document.createElement('script');
      script.textContent = xhr.responseText;
      document.head.appendChild(script);
      return Boolean(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.projectId);
    }

    return false;
  }

  function loadConfig() {
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.projectId) {
      return;
    }

    const candidateUrls = buildCandidateUrls();
    for (const url of candidateUrls) {
      if (loadConfigFromUrl(url)) {
        return;
      }
    }
  }

  window.loadFirebaseConfig = loadConfig;
  loadConfig();
})();

(function () {
  function getRepoBase() {
    try {
      const scriptUrl = document.currentScript && document.currentScript.src;
      if (scriptUrl) {
        const pathname = new URL(scriptUrl).pathname;
        const idx = pathname.indexOf('/js/');
        if (idx !== -1) {
          return pathname.substring(0, idx);
        }
      }

      const locationPath = window.location.pathname;
      if (locationPath.includes('/pages/')) {
        return locationPath.replace(/\/pages\/.*$/, '');
      }
      return locationPath.replace(/\/[^/]*$/, '') || '';
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
    return fetch(url, { cache: 'no-cache', mode: 'cors' })
      .then((resp) => {
        if (!resp.ok) return false;
        return resp.text().then((text) => {
          const script = document.createElement('script');
          script.textContent = text;
          document.head.appendChild(script);
          return Boolean(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.projectId);
        });
      })
      .catch(() => false);
  }

  async function loadConfig() {
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.projectId) {
      return;
    }

    const candidateUrls = buildCandidateUrls();
    console.debug('loadFirebaseConfig: candidate URLs', candidateUrls);
    for (const url of candidateUrls) {
      // try each URL in sequence until one succeeds
      // eslint-disable-next-line no-await-in-loop
      const ok = await loadConfigFromUrl(url);
      if (ok) return;
    }
  }

  window.loadFirebaseConfig = loadConfig;
  loadConfig();
})();

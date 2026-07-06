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

  function getPathSegments() {
    try {
      const path = window.location.pathname.replace(/\/+$/, '');
      return path ? path.split('/').filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  function buildCandidateUrls() {
    const repoBase = getRepoBase();
    const candidates = [];
    const origin = window.location.origin;
    const segments = getPathSegments();
    const repoName = segments[0] || 'silvertech-website';

    if (repoBase) {
      candidates.push(`${origin}${repoBase}/firebase-config.js`);
    }

    if (segments.length) {
      const currentPathBase = segments.slice(0, -1).join('/');
      if (currentPathBase) {
        candidates.push(`${origin}/${currentPathBase}/firebase-config.js`);
      }
    }

    candidates.push(`${origin}/${repoName}/firebase-config.js`);
    candidates.push(`${origin}/firebase-config.js`);
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
      // eslint-disable-next-line no-await-in-loop
      const ok = await loadConfigFromUrl(url);
      if (ok) return;
    }

    console.warn('Firebase config was not loaded from any known URL. Authentication will remain unavailable until the config file is published.');
  }

  window.loadFirebaseConfig = loadConfig;
  loadConfig();
})();

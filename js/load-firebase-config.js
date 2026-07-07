(function () {
  function buildCandidateUrls() {
    const candidates = [];
    const origin = window.location.origin;
    const pathname = window.location.pathname.replace(/\/$/, '');
    const repoBase = pathname.includes('/silvertech-website') ? '/silvertech-website' : '';

    candidates.push(`${origin}${repoBase}/firebase-config.js`);
    candidates.push(`${origin}${repoBase}/js/firebase-config.js`);
    candidates.push(`${origin}/firebase-config.js`);
    candidates.push(`${origin}/js/firebase-config.js`);

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

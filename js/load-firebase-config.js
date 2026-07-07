(function () {
  function getCurrentScriptUrl() {
    try {
      if (document.currentScript && document.currentScript.src) {
        return new URL(document.currentScript.src, window.location.href);
      }

      const scripts = Array.from(document.getElementsByTagName('script'));
      const loaderScript = scripts.find((script) => /load-firebase-config\.js/.test(script.src));
      if (loaderScript && loaderScript.src) {
        return new URL(loaderScript.src, window.location.href);
      }
    } catch (error) {
      console.debug('Unable to resolve current script URL:', error);
    }

    return null;
  }

  function getRepoBase() {
    try {
      const scriptUrl = getCurrentScriptUrl();
      if (!scriptUrl) {
        return '';
      }

      const pathname = scriptUrl.pathname;
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
    const scriptUrl = getCurrentScriptUrl();
    const currentPath = window.location.pathname;

    if (scriptUrl) {
      candidates.push(new URL('../firebase-config.js', scriptUrl).toString());
      candidates.push(new URL('./firebase-config.js', scriptUrl).toString());
      candidates.push(new URL('../js/firebase-config.js', scriptUrl).toString());
      candidates.push(new URL('./js/firebase-config.js', scriptUrl).toString());
    }

    if (repoBase) {
      candidates.push(`${origin}${repoBase}/firebase-config.js`);
      candidates.push(`${origin}${repoBase}/js/firebase-config.js`);
    }

    if (currentPath.includes('/silvertech-website')) {
      candidates.push(`${origin}/silvertech-website/firebase-config.js`);
      candidates.push(`${origin}/silvertech-website/js/firebase-config.js`);
    }

    candidates.push(`${origin}/firebase-config.js`);
    candidates.push(`${origin}/js/firebase-config.js`);
    candidates.push(`${origin}/silvertech-website/firebase-config.js`);
    candidates.push(`${origin}/silvertech-website/js/firebase-config.js`);
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

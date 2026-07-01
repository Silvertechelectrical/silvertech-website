// Try to load /firebase-config.js from site root, fallback to gh-pages raw file if missing.
(function loadFirebaseConfig(){
  // Determine repository base using the loader script's own URL when possible.
  // This is more reliable than location.pathname because pages may be served
  // from different base paths (user site vs project site).
  let repoBase = '';
  try {
    const scriptUrl = document.currentScript && document.currentScript.src;
    if (scriptUrl) {
      const p = new URL(scriptUrl).pathname; // e.g. /silvertech-website/js/load-firebase-config.js
      const idx = p.indexOf('/js/');
      if (idx !== -1) repoBase = p.substring(0, idx);
    }
  } catch (e) {
    repoBase = '';
  }

  const candidateUrls = [];
  if (repoBase) candidateUrls.push(`${location.origin}${repoBase}/firebase-config.js`);
  // Try site-root path too (useful for user/org pages or if repo deployed at root)
  candidateUrls.push(`${location.origin}/firebase-config.js`);
  // final fallback: raw gh-pages branch
  candidateUrls.push('https://raw.githubusercontent.com/Brianwgitau/silvertech-website/gh-pages/firebase-config.js');

  function insertScript(src){
    const s = document.createElement('script');
    s.src = src;
    s.async = false; // preserve execution order before firebase-init
    document.head.appendChild(s);
  }

  // Try HEAD sequentially until we find an available config
  (async function tryUrls(){
    for (const url of candidateUrls) {
      try {
        const resp = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        if (resp.ok) {
          insertScript(url);
          return;
        }
      } catch (e) {
        // ignore and try next
      }
    }
    // If none worked, try inserting the raw fallback script as last resort
    insertScript(candidateUrls[candidateUrls.length - 1]);
  })();
})();

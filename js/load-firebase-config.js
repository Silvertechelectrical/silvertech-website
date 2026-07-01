// Try to load /firebase-config.js from site root, fallback to gh-pages raw file if missing.
(function loadFirebaseConfig(){
  const rootUrl = '/firebase-config.js';
  const fallbackUrl = 'https://raw.githubusercontent.com/Brianwgitau/silvertech-website/gh-pages/firebase-config.js';

  function insertScript(src){
    const s = document.createElement('script');
    s.src = src;
    s.async = false; // preserve execution order before firebase-init
    document.head.appendChild(s);
  }

  // Try HEAD first to avoid executing invalid or missing script
  fetch(rootUrl, { method: 'HEAD', cache: 'no-cache' }).then(resp => {
    if (resp.ok) {
      insertScript(rootUrl);
    } else {
      insertScript(fallbackUrl);
    }
  }).catch(() => {
    // network or CORS error -> try fallback directly
    insertScript(fallbackUrl);
  });
})();

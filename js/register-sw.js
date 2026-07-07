(function () {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const isNestedPage = window.location.pathname.includes('/pages/');
  const basePath = isNestedPage ? '../' : './';
  const scopeUrl = new URL(basePath, window.location.href);
  const swUrl = new URL('sw.js', scopeUrl);

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: scopeUrl.pathname
      });
      console.log('Silvertech service worker registered at', registration.scope);
    } catch (error) {
      console.warn('Silvertech service worker registration failed:', error);
    }
  });
})();

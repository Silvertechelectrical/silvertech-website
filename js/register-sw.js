(function () {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const currentPath = window.location.pathname;
  const pagesIndex = currentPath.indexOf('/pages/');
  const rootPath = pagesIndex >= 0
    ? currentPath.slice(0, pagesIndex + 1)
    : currentPath.replace(/\/[^/]*$/, '/') || '/';
  const swUrl = new URL(`${rootPath}sw.js`, window.location.origin);
  const scopeUrl = new URL(rootPath, window.location.origin);

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

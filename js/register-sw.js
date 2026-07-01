(function () {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const currentScript = document.currentScript;
  const swUrl = currentScript
    ? new URL('../sw.js', currentScript.src).toString()
    : new URL('sw.js', window.location.href).toString();

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(swUrl);
      console.log('Silvertech service worker registered at', registration.scope);
    } catch (error) {
      console.warn('Silvertech service worker registration failed:', error);
    }
  });
})();

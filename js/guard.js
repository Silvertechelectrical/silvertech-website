(function () {
  const redirectTarget = window.location.pathname + window.location.search;

  function redirectToLogin() {
    try {
      sessionStorage.setItem('redirectAfterLogin', redirectTarget);
    } catch (error) {
      console.warn('Unable to persist redirect target:', error);
    }

    const loginUrl = new URL('../login.html', window.location.href);
    window.location.replace(loginUrl.href);
  }

  async function verifyAuth() {
    try {
      const firebaseModule = await import('../js/firebase-init.js');
      const { auth } = firebaseModule;
      const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js');

      onAuthStateChanged(auth, (user) => {
        if (!user) {
          redirectToLogin();
          return;
        }

        const storedRole = sessionStorage.getItem('userRole');
        if (storedRole === 'guest') {
          redirectToLogin();
        }
      });
    } catch (error) {
      console.warn('Auth guard could not initialize:', error);
      redirectToLogin();
    }
  }

  void verifyAuth();
})();

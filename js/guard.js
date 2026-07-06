// guard.js - simple synchronous guard that checks sessionStorage for a cached 'user'
// If not present, it sets a redirect target and sends the visitor to the login page.
(function () {
  try {
    const raw = sessionStorage.getItem('user');
    if (!raw) {
      // preserve where the user wanted to go
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
      // send them to the login page (root-absolute)
      window.location.href = '/pages/login.html';
      return;
    }

    const user = JSON.parse(raw);
    if (!user || user.role === 'guest') {
      // Guests are not allowed on restricted pages
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
      window.location.href = '/pages/login.html';
      return;
    }
  } catch (err) {
    // If anything goes wrong, redirect to login conservatively
    try {
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
    } catch (e) {}
    window.location.href = '/pages/login.html';
  }
})();

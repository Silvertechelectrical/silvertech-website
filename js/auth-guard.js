import { auth } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { hasAnyRole } from './role-utils.js';

function getLoginUrl() {
  return window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
}

export function redirectToLogin() {
  sessionStorage.setItem('redirectAfterLogin', window.location.href);
  window.location.href = getLoginUrl();
}

export function redirectToPage(url) {
  if (!url) return;
  window.location.href = url;
}

export function requireAuth() {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
        return;
      }
      redirectToLogin();
    });
  });
}

export async function requireRoles(roles, redirectUrl = null) {
  const user = await requireAuth();
  if (!user) return null;
  const allowed = await hasAnyRole(user, roles);
  if (!allowed) {
    if (redirectUrl) {
      redirectToPage(redirectUrl);
    } else {
      redirectToLogin();
    }
    return null;
  }
  return user;
}

import { auth, db } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { ensureUserProfile, isAdminUser, isDeveloperUser, getUserRole } from './role-utils.js';

const emailInput = document.getElementById('email');
const passInput = document.getElementById('password');
const statusMessage = document.getElementById('status-message');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const showPasswordToggle = document.getElementById('show-password-toggle');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const DEMO_USERS_KEY = 'silvertech-demo-users';
const DEMO_SESSION_KEY = 'silvertech-demo-user';

function setStatus(message, isError = false) {
  if (statusMessage) {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? '#ff7b7b' : '#00D4FF';
  }
}

function getRelativePageUrl(targetPath) {
  const currentPath = window.location.pathname.replace(/\/$/, '');
  const segments = currentPath.split('/').filter(Boolean);
  const pagesIndex = segments.indexOf('pages');

  if (pagesIndex === -1) {
    return `pages/${targetPath}`;
  }

  const afterPages = segments.slice(pagesIndex + 1);
  const currentDir = afterPages.length && afterPages[afterPages.length - 1].includes('.')
    ? afterPages.slice(0, -1)
    : afterPages;
  const prefix = currentDir.length ? currentDir.map(() => '..').join('/') + '/' : '';
  return `${prefix}${targetPath}`;
}

function getDemoUsers() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_USERS_KEY) || '{}');
  } catch (error) {
    console.warn('Unable to read demo users:', error);
    return {};
  }
}

function saveDemoUsers(users) {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
}

function persistDemoSession(user) {
  sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
  sessionStorage.setItem('user', JSON.stringify(user));
}

function clearDemoSession() {
  sessionStorage.removeItem(DEMO_SESSION_KEY);
  sessionStorage.removeItem('user');
}

function getDemoUser(email) {
  const users = getDemoUsers();
  return users[email.toLowerCase()] || null;
}

function getDemoRole(email) {
  if (email.toLowerCase().includes('admin')) return 'admin';
  if (email.toLowerCase().includes('developer')) return 'developer';
  return 'user';
}

function syncDemoAuthUi(user = null) {
  const authStatus = document.getElementById('auth-status');
  if (authStatus) {
    authStatus.textContent = user ? `Signed in as ${user.email}` : 'Guest access';
  }
  if (deleteAccountBtn) {
    deleteAccountBtn.classList.toggle('hidden', !user);
  }
}

async function handleDemoLogin() {
  if (!emailInput || !passInput) return;
  const email = emailInput.value.trim();
  const password = passInput.value;
  const users = getDemoUsers();
  const storedUser = users[email.toLowerCase()];

  if (!storedUser || storedUser.password !== password) {
    setStatus('Invalid demo account. Create an account first or use the seeded demo credentials.', true);
    return;
  }

  const sessionUser = { uid: `demo-${email.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, email, displayName: email.split('@')[0], role: getDemoRole(email) };
  persistDemoSession(sessionUser);
  syncDemoAuthUi(sessionUser);
  setStatus('Signed in in demo mode.');
  window.location.href = getRelativePageUrl('dashboard.html');
}

async function handleDemoRegister() {
  if (!emailInput || !passInput) return;
  const email = emailInput.value.trim();
  const password = passInput.value;
  if (!email || !password) {
    setStatus('Enter an email and password to create a demo account.', true);
    return;
  }

  const users = getDemoUsers();
  if (users[email.toLowerCase()]) {
    setStatus('That demo account already exists. Try signing in instead.', true);
    return;
  }

  users[email.toLowerCase()] = { email, password };
  saveDemoUsers(users);
  const sessionUser = { uid: `demo-${email.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, email, displayName: email.split('@')[0], role: getDemoRole(email) };
  persistDemoSession(sessionUser);
  syncDemoAuthUi(sessionUser);
  setStatus('Demo account created successfully.');
  window.location.href = getRelativePageUrl('dashboard.html');
}

async function handleLogin() {
  if (!emailInput || !passInput) return;
  if (!auth) {
    await handleDemoLogin();
    return;
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
    if (credential.user) {
      await ensureUserProfile(credential.user);
    }

    const redirectTarget = sessionStorage.getItem('redirectAfterLogin');
    if (redirectTarget) {
      window.location.href = redirectTarget;
      return;
    }

    const currentUser = auth.currentUser;
    if (currentUser) {
      const role = await getUserRole(currentUser);
      sessionStorage.setItem('user', JSON.stringify({ uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName, role }));
      const isAdmin = await isAdminUser(currentUser);
      const isDeveloper = await isDeveloperUser(currentUser);
      if (isAdmin || isDeveloper) {
        window.location.href = getRelativePageUrl('developer-dashboard.html');
        return;
      }
    }

    window.location.href = getRelativePageUrl('dashboard.html');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleRegister() {
  if (!emailInput || !passInput) return;
  if (!auth) {
    await handleDemoRegister();
    return;
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
    if (credential.user) {
      await ensureUserProfile(credential.user);
    }
    setStatus('Account created successfully. Redirecting to your dashboard.');
    setTimeout(() => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        getUserRole(currentUser).then((role) => {
          sessionStorage.setItem('user', JSON.stringify({ uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName, role }));
          window.location.href = getRelativePageUrl('dashboard.html');
        }).catch(() => window.location.href = getRelativePageUrl('dashboard.html'));
        return;
      }
      window.location.href = getRelativePageUrl('dashboard.html');
    }, 700);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleGoogleLogin() {
  if (!auth) {
    setStatus('Firebase is not configured yet. Demo mode is active, so use email/password to continue.', true);
    return;
  }

  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    const result = await signInWithPopup(auth, provider);
    if (result.user) {
      await ensureUserProfile(result.user);
    }

    const redirectTarget = sessionStorage.getItem('redirectAfterLogin');
    if (redirectTarget) {
      window.location.href = redirectTarget;
      return;
    }

    const currentUser = auth.currentUser;
    if (currentUser) {
      const role = await getUserRole(currentUser);
      sessionStorage.setItem('user', JSON.stringify({ uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName, role }));
      const isAdmin = await isAdminUser(currentUser);
      const isDeveloper = await isDeveloperUser(currentUser);
      if (isAdmin || isDeveloper) {
        window.location.href = getRelativePageUrl('developer-dashboard.html');
        return;
      }
    }

    window.location.href = getRelativePageUrl('dashboard.html');
  } catch (error) {
    setStatus(error.message || 'Google sign-in failed.', true);
  }
}

if (showPasswordToggle && passInput) {
  showPasswordToggle.addEventListener('change', () => {
    passInput.type = showPasswordToggle.checked ? 'text' : 'password';
  });
}

if (loginBtn) loginBtn.addEventListener('click', handleLogin);
if (registerBtn) registerBtn.addEventListener('click', handleRegister);
if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', handleGoogleLogin);
}
if (logoutBtn) logoutBtn.addEventListener('click', async () => {
  if (auth) {
    await signOut(auth);
  }
  clearDemoSession();
  window.location.href = window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
});

if (auth) {
  onAuthStateChanged(auth, async (user) => {
    const authStatus = document.getElementById('auth-status');
    if (authStatus) {
      authStatus.textContent = user ? `Signed in as ${user.email}` : 'Guest access';
    }
    if (deleteAccountBtn) {
      deleteAccountBtn.classList.toggle('hidden', !user);
    }

    if (user) {
      try {
        const role = await getUserRole(user);
        sessionStorage.setItem('user', JSON.stringify({ uid: user.uid, email: user.email, displayName: user.displayName, role }));
      } catch (err) {
        console.warn('Failed to populate session user role:', err);
      }
    } else {
      sessionStorage.removeItem('user');
    }
  });
} else {
  const demoUser = sessionStorage.getItem(DEMO_SESSION_KEY);
  if (demoUser) {
    syncDemoAuthUi(JSON.parse(demoUser));
  } else {
    syncDemoAuthUi();
  }
}

if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener('click', async () => {
    if (!auth) {
      const demoUser = sessionStorage.getItem(DEMO_SESSION_KEY);
      if (!demoUser) return setStatus('No demo user signed in', true);
      const parsedUser = JSON.parse(demoUser);
      const users = getDemoUsers();
      delete users[parsedUser.email.toLowerCase()];
      saveDemoUsers(users);
      clearDemoSession();
      syncDemoAuthUi();
      setStatus('Demo account deleted.');
      return;
    }

    const user = auth.currentUser;
    if (!user) return setStatus('No user signed in', true);
    const confirmed = confirm('Delete your account? This action is permanent and will remove your profile. Are you sure?');
    if (!confirmed) return;

    const providerId = user.providerData && user.providerData[0] && user.providerData[0].providerId;
    if (providerId && providerId !== 'password') {
      return setStatus('Please reauthenticate via your sign-in provider or contact support to delete this account.', true);
    }

    const password = prompt('Please enter your password to confirm account deletion:');
    if (!password) return setStatus('Password required to confirm deletion.', true);

    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    } catch (err) {
      console.error('Reauthentication failed:', err);
      return setStatus('Reauthentication failed. Please try again.', true);
    }

    try {
      await deleteDoc(doc(db, 'users', user.uid));
    } catch (err) {
      console.warn('Failed to delete user document:', err);
    }

    try {
      await deleteUser(user);
      setStatus('Account deleted successfully. Redirecting...');
      setTimeout(() => window.location.href = '../index.html', 900);
    } catch (err) {
      console.error('Failed to delete auth user:', err);
      setStatus('Failed to delete account: ' + err.message, true);
    }
  });
}

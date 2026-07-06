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

function setStatus(message, isError = false) {
  if (statusMessage) {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? '#ff7b7b' : '#00D4FF';
  }
}

async function handleLogin() {
  if (!emailInput || !passInput) return;
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
        window.location.href = '/pages/developer-dashboard.html';
        return;
      }
    }

    window.location.href = '/pages/dashboard.html';
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleRegister() {
  if (!emailInput || !passInput) return;
  try {
    const credential = await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
    if (credential.user) {
      await ensureUserProfile(credential.user);
    }
    setStatus('Account created successfully. Redirecting to your dashboard.');
    setTimeout(() => {
      // Set session user after registration
      const currentUser = auth.currentUser;
      if (currentUser) {
        getUserRole(currentUser).then((role) => {
          sessionStorage.setItem('user', JSON.stringify({ uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName, role }));
          window.location.href = '/pages/dashboard.html';
        }).catch(() => window.location.href = '/pages/dashboard.html');
        return;
      }
      window.location.href = '/pages/dashboard.html';
    }, 700);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleGoogleLogin() {
  if (!auth) {
    setStatus('Firebase is not configured yet. Please load the site config first.', true);
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
        window.location.href = '/pages/developer-dashboard.html';
        return;
      }
    }

    window.location.href = '/pages/dashboard.html';
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
  await signOut(auth);
  sessionStorage.removeItem('user');
  window.location.href = '/index.html';
});

onAuthStateChanged(auth, async (user) => {
  const authStatus = document.getElementById('auth-status');
  if (authStatus) {
    authStatus.textContent = user ? `Signed in as ${user.email}` : 'Guest access';
  }
  if (deleteAccountBtn) {
    if (user) {
      deleteAccountBtn.classList.remove('hidden');
    } else {
      deleteAccountBtn.classList.add('hidden');
    }
  }

  // Maintain a lightweight session cache so guard.js can redirect synchronously
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

if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return setStatus('No user signed in', true);
    const confirmed = confirm('Delete your account? This action is permanent and will remove your profile. Are you sure?');
    if (!confirmed) return;

    // Only support email/password reauthentication from the client.
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
      // Attempt to delete the Firestore user document (rules now allow owners to delete their doc).
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

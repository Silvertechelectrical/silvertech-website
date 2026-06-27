import { auth } from './firebase-init.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { isAdminUser } from './role-utils.js';

const navLinks = document.querySelector('.nav-links');
const isPageRoute = window.location.pathname.includes('/pages/');
const loginHref = isPageRoute ? 'login.html' : 'pages/login.html';
const adminHref = isPageRoute ? 'admin.html' : 'pages/admin.html';

function createLoginLink() {
  const link = document.createElement('a');
  link.href = loginHref;
  link.id = 'nav-login-link';
  link.textContent = 'Login';
  return link;
}

function createAdminLink() {
  const link = document.createElement('a');
  link.href = adminHref;
  link.id = 'nav-admin-link';
  link.textContent = 'Admin';
  return link;
}

function createUserNav(user) {
  const wrapper = document.createElement('span');
  wrapper.className = 'nav-user';

  if (user.photoURL) {
    const img = document.createElement('img');
    img.className = 'profile-pic';
    img.src = user.photoURL;
    img.alt = `${user.displayName || 'User'} profile`;
    wrapper.appendChild(img);
  } else {
    const initials = document.createElement('span');
    initials.className = 'profile-pic profile-initials';
    const name = user.displayName || user.email || 'U';
    initials.textContent = name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    wrapper.appendChild(initials);
  }

  const emailLabel = document.createElement('span');
  emailLabel.className = 'nav-user-email';
  emailLabel.textContent = user.email || user.displayName || 'User';
  wrapper.appendChild(emailLabel);

  const logoutButton = document.createElement('button');
  logoutButton.type = 'button';
  logoutButton.className = 'nav-logout-btn';
  logoutButton.textContent = 'Logout';
  logoutButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    await signOut(auth);
    window.location.reload();
  });
  wrapper.appendChild(logoutButton);

  wrapper.addEventListener('click', () => {
    wrapper.classList.toggle('open');
    wrapper.setAttribute('aria-expanded', wrapper.classList.contains('open') ? 'true' : 'false');
  });

  wrapper.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      wrapper.click();
    }
  });

  return wrapper;
}

async function updateNav(user) {
  if (!navLinks) return;

  const existingLogin = navLinks.querySelector('#nav-login-link');
  const existingUser = navLinks.querySelector('.nav-user');
  const existingAdmin = navLinks.querySelector('#nav-admin-link');
  if (existingUser) existingUser.remove();
  if (existingAdmin) existingAdmin.remove();
  if (existingLogin) existingLogin.remove();

  navLinks.querySelectorAll('a').forEach((anchor) => {
    if (anchor.textContent.trim().toLowerCase() === 'login') {
      anchor.remove();
    }
  });

  if (user) {
    const isAdmin = await isAdminUser(user);
    if (isAdmin) {
      navLinks.appendChild(createAdminLink());
    }
    navLinks.appendChild(createUserNav(user));
  } else {
    navLinks.appendChild(createLoginLink());
  }
}

onAuthStateChanged(auth, async (user) => {
  await updateNav(user);
});

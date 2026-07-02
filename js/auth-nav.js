import { auth } from './firebase-init.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { isAdminUser } from './role-utils.js';

const navLinks = document.querySelector('.nav-links');
const isPageRoute = window.location.pathname.includes('/pages/');
const loginHref = isPageRoute ? 'login.html' : 'pages/login.html';
const adminHref = isPageRoute ? 'admin.html' : 'pages/admin.html';
const currentPageName = window.location.pathname.split('/').pop();
const heroState = document.getElementById('hero-user-state');

function updateHeroGreeting(user) {
  if (!heroState) return;
  if (!user) {
    heroState.classList.add('hidden');
    heroState.textContent = '';
    return;
  }

  const displayName = user.displayName || user.email || 'there';
  heroState.textContent = `Welcome back, ${displayName}`;
  heroState.classList.remove('hidden');
}

function createLoginLink() {
  const link = document.createElement('a');
  link.href = loginHref;
  link.id = 'nav-login-link';
  link.className = 'btn btn-primary nav-login-btn';
  link.textContent = 'Login';
  return link;
}

function createAdminLink() {
  const link = document.createElement('a');
  link.href = adminHref;
  link.className = 'dropdown-item';
  link.textContent = 'Admin Dashboard';
  return link;
}

function createUserNav(user, isAdmin = false) {
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

  const emailLabel = document.createElement('div');
  emailLabel.className = 'nav-user-email';
  const emailText = document.createElement('strong');
  emailText.textContent = user.email || user.displayName || 'User';
  emailLabel.appendChild(emailText);

  if (isAdmin) {
    const adminLink = createAdminLink();
    emailLabel.appendChild(adminLink);
  }

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
  if (existingUser) existingUser.remove();
  if (existingLogin) existingLogin.remove();

  navLinks.querySelectorAll('a, button').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (href && href.endsWith(currentPageName)) {
      anchor.classList.add('hidden');
    }
    if (anchor.textContent.trim().toLowerCase() === 'login') {
      anchor.remove();
    }
  });

  if (user) {
    const isAdmin = await isAdminUser(user);
    navLinks.appendChild(createUserNav(user, isAdmin));
  } else {
    navLinks.appendChild(createLoginLink());
  }
}

onAuthStateChanged(auth, async (user) => {
  updateHeroGreeting(user);
  await updateNav(user);
});

import { auth } from './firebase-init.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { isAdminUser, getUserRole } from './role-utils.js';

const navLinks = document.querySelector('.nav-links');

function getRelativePath(targetPath) {
  const currentPath = window.location.pathname.replace(/\/$/, '');
  const segments = currentPath.split('/').filter(Boolean);
  const pagesIndex = segments.indexOf('pages');

  if (pagesIndex === -1) {
    return `pages/${targetPath}`;
  }

  const afterPages = segments.slice(pagesIndex + 1);
  const hasFileName = afterPages.length && afterPages[afterPages.length - 1].includes('.');
  const directorySegments = hasFileName ? afterPages.slice(0, -1) : afterPages;
  const prefix = directorySegments.length ? directorySegments.map(() => '..').join('/') + '/' : '';

  return `${prefix}${targetPath}`;
}

const loginHref = getRelativePath('login.html');
const adminHref = getRelativePath('admin.html');
const storeHref = getRelativePath('store/index.html');
const dashboardAdminHref = getRelativePath('admin.html');
const dashboardDeveloperHref = getRelativePath('developer-dashboard.html');
const heroState = document.getElementById('hero-user-state');

async function updateHeroGreeting(user) {
  if (!heroState) return;
  if (!user) {
    heroState.classList.add('hidden');
    heroState.textContent = '';
    return;
  }

  const displayName = user.displayName || user.email || 'there';
  const role = await getUserRole(user);
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  heroState.textContent = `Welcome back, ${displayName} (${roleLabel})`;
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

  // Remove all dynamic nav items (everything except Services and Shop)
  const childrenToRemove = [];
  navLinks.querySelectorAll('a, .nav-user, button').forEach((el) => {
    const href = el.getAttribute('href');
    const text = el.textContent.trim();
    // Keep Services and Shop (static items)
    if (text !== 'Services' && text !== 'Shop') {
      childrenToRemove.push(el);
    }
  });
  childrenToRemove.forEach((el) => el.remove());

  if (user) {
    const isAdmin = await isAdminUser(user);
    console.debug(`[auth-nav] User: ${user.email}, isAdmin: ${isAdmin}`);

    // Add Store link for authenticated users
    const storeLink = document.createElement('a');
    storeLink.href = storeHref;
    storeLink.className = 'nav-link-pill';
    storeLink.textContent = 'Store';
    navLinks.appendChild(storeLink);

    // Only show Dashboard for admins - strict check
    console.debug(`[auth-nav] isAdmin strict check: ${isAdmin} (type: ${typeof isAdmin})`);
    if (isAdmin === true) {
      console.debug('[auth-nav] ✓ Adding Dashboard link for admin user');
      const dashboardLink = document.createElement('a');
      dashboardLink.href = dashboardAdminHref;
      dashboardLink.className = 'nav-link-pill';
      dashboardLink.id = 'nav-dashboard-link';
      dashboardLink.textContent = 'Dashboard';
      navLinks.appendChild(dashboardLink);
    } else {
      console.debug('[auth-nav] ✗ NOT adding Dashboard - user is not admin');
    }

    // Add user nav LAST so it appears rightmost
    navLinks.appendChild(createUserNav(user, isAdmin));

    // FINAL DEFENSIVE CHECK: Remove Dashboard if user is not admin
    if (!isAdmin) {
      const allLinks = Array.from(navLinks.querySelectorAll('a'));
      allLinks.forEach((link) => {
        const text = link.textContent.trim();
        const href = link.getAttribute('href') || '';
        if (text === 'Dashboard' || href.includes('dashboard') || href.includes('admin')) {
          console.debug('[auth-nav] FINAL CHECK: Removing Dashboard/Admin link from non-admin user');
          link.remove();
        }
      });
    }
  } else {
    // Unauthenticated user: show Store and Login links
    const storeLink = document.createElement('a');
    storeLink.href = storeHref;
    storeLink.className = 'nav-link-pill';
    storeLink.textContent = 'Store';
    navLinks.appendChild(storeLink);

    console.debug('[auth-nav] Adding Login link (unauthenticated)');
    navLinks.appendChild(createLoginLink());
  }
}

(async () => {
  if (auth) {
    onAuthStateChanged(auth, async (user) => {
      await updateHeroGreeting(user);
      await updateNav(user);
    });
  } else {
    // Fallback if Firebase auth not immediately available
    setTimeout(async () => {
      if (auth) {
        onAuthStateChanged(auth, async (user) => {
          await updateHeroGreeting(user);
          await updateNav(user);
        });
      } else {
        console.warn('Firebase auth is not available.');
        await updateNav(null);
      }
    }, 100);
  }
})();

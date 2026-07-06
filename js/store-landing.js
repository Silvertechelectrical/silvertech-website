import { auth } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getUserProfile, isAdminUser, isDeveloperUser, ROLES } from './role-utils.js';

const uploadButton = document.getElementById('store-upload-action');
const verifyButton = document.getElementById('store-verify-action');
const registerDeveloperButton = document.getElementById('register-developer-button');
const developerDashboardButton = document.getElementById('developer-dashboard-button');
const accessBanner = document.getElementById('store-access-banner');

function setBanner(message, isError = false) {
  if (!accessBanner) return;
  accessBanner.textContent = message;
  accessBanner.classList.toggle('hidden', !message);
  accessBanner.style.color = isError ? '#ff7b7b' : '';
}

function showElement(element, show) {
  if (!element) return;
  element.classList.toggle('hidden', !show);
}

function setButtonHref(element, href) {
  if (!element) return;
  element.href = href;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showElement(uploadButton, false);
    showElement(verifyButton, false);
    showElement(developerDashboardButton, false);
    showElement(registerDeveloperButton, true);
    setBanner('Sign in to upload listings, manage approvals, or view your developer dashboard.');
    return;
  }

  const userProfile = await getUserProfile(user);
  const isAdmin = await isAdminUser(user);
  const isDeveloper = await isDeveloperUser(user);

  showElement(uploadButton, isAdmin || isDeveloper);
  showElement(verifyButton, isAdmin);
  showElement(developerDashboardButton, isAdmin || isDeveloper);
  showElement(registerDeveloperButton, !isAdmin && !isDeveloper);

  if (isAdmin) {
    setBanner('Administrator access detected. You can manage store listings and developer approvals.');
  } else if (isDeveloper) {
    setBanner('Developer access detected. You can upload store assets and review your account status.');
  } else {
    setBanner('Browse the store and apply to become a developer for upload access.');
  }

  if (userProfile?.role) {
    document.body.dataset.userRole = userProfile.role;
  }
});

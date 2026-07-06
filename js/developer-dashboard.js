import { auth } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getUserProfile, isAdminUser, isDeveloperUser } from './role-utils.js';

const actionsContainer = document.getElementById('developer-actions');
const adminCard = document.getElementById('developer-admin-card');
const banner = document.getElementById('developer-dashboard-banner');

function showElement(element, show) {
  if (!element) return;
  element.classList.toggle('hidden', !show);
}

function createActionLink(href, label, style = 'btn btn-secondary') {
  const link = document.createElement('a');
  link.href = href;
  link.className = style;
  link.textContent = label;
  return link;
}

function setBanner(message, isError = false) {
  if (!banner) return;
  banner.textContent = message;
  banner.classList.toggle('hidden', !message);
  banner.style.color = isError ? '#ff7b7b' : '';
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    setBanner('Please sign in to access your developer tools.');
    actionsContainer.innerHTML = '';
    showElement(adminCard, false);
    return;
  }

  const profile = await getUserProfile(user);
  const isAdmin = await isAdminUser(user);
  const isDeveloper = await isDeveloperUser(user);

  actionsContainer.innerHTML = '';
  if (isAdmin || isDeveloper) {
    actionsContainer.appendChild(createActionLink('store-upload.html', 'Upload Store Listing'));
    actionsContainer.appendChild(createActionLink('store-browse.html', 'Browse Store Apps', 'btn btn-primary'));
    if (isAdmin) {
      showElement(adminCard, true);
      actionsContainer.appendChild(createActionLink('store-verify-developer.html', 'Developer Approvals', 'btn btn-secondary'));
    } else {
      showElement(adminCard, false);
    }
    setBanner(`Welcome ${profile?.displayName || user.email}. You are signed in as ${profile?.role || 'developer'}.`);
    return;
  }

  setBanner('You are not authorized to use the developer dashboard. Please apply for developer access.');
  actionsContainer.innerHTML = '';
  showElement(adminCard, false);
});

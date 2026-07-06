import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  updateDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const adminLoading = document.getElementById('admin-loading');
const adminUnauthenticated = document.getElementById('admin-unauthenticated');
const adminUnauthorized = document.getElementById('admin-unauthorized');
const adminShell = document.getElementById('admin-shell');
const adminWelcome = document.getElementById('admin-welcome');
const headerLogoutBtn = document.getElementById('headerLogoutBtn');
const serviceForm = document.getElementById('admin-service-form');
const serviceStatus = document.getElementById('admin-service-status');
const servicesList = document.getElementById('admin-services-list');
const serviceSearch = document.getElementById('service-search');
const serviceFilterCategory = document.getElementById('service-filter-category');
const adminMetrics = document.getElementById('admin-metrics');

let currentUser = null;
let editingServiceId = null;
let servicesCache = [];

function showSection(section) {
  [adminLoading, adminUnauthenticated, adminUnauthorized, adminShell].forEach((el) => {
    if (!el) return;
    el.classList.add('hidden');
  });

  if (section) {
    section.classList.remove('hidden');
  }
}

function populateServiceForm(service) {
  if (!serviceForm) return;
  document.getElementById('service-name').value = service.name || '';
  document.getElementById('service-category').value = service.category || '';
  document.getElementById('service-price').value = service.price || '';
  document.getElementById('service-delivery').value = service.delivery || '';
  document.getElementById('service-description').value = service.description || '';
  document.getElementById('service-featured').checked = Boolean(service.featured);
  editingServiceId = service.id || null;
  const submitButton = serviceForm.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.textContent = editingServiceId ? 'Update Service' : 'Save Service';
  }
}

async function loadAdminMetrics() {
  if (!adminMetrics) return;

  try {
    const pendingDevelopers = await getDocs(query(collection(db, 'developer-applications'), where('status', '==', 'pending')));
    const pendingRequests = await getDocs(query(collection(db, 'requests'), where('status', '==', 'pending')));
    adminMetrics.innerHTML = `● ${pendingDevelopers.size} Pending Developer Approvals • ${pendingRequests.size} New Service Requests`;
    adminMetrics.classList.remove('hidden');
  } catch (error) {
    console.error('Failed to load admin metrics:', error);
    adminMetrics.classList.add('hidden');
  }
}

function dedupeServices(items) {
  const seen = new Set();
  return items.filter((service) => {
    const key = service.id || `${service.name || ''}-${service.category || ''}-${service.price || ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function renderServiceCards(items) {
  if (!servicesList) return;

  const uniqueServices = dedupeServices(items);

  if (!uniqueServices.length) {
    servicesList.innerHTML = '<p class="small">No services found. Add one from the form above.</p>';
    return;
  }

  servicesList.innerHTML = uniqueServices
    .map((service) => `
      <article class="service-card">
        <div class="catalog-card-actions">
          <button class="catalog-action edit-btn" data-edit-id="${service.id}" type="button" aria-label="Edit service">✎</button>
          <button class="catalog-action delete-btn" data-id="${service.id}" type="button" aria-label="Delete service">✕</button>
        </div>
        <div class="service-top">
          <h3>${service.name}</h3>
        </div>
        <p class="meta">${service.category}</p>
        <p>${service.description}</p>
        <p class="meta">Price: ${service.price} KSH</p>
        <p class="meta">Delivery: ${service.delivery || 'Not specified'}</p>
      </article>
    `)
    .join('');

  servicesList.querySelectorAll('button[data-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const serviceId = button.dataset.id;
      if (!serviceId) return;

      // Ask for confirmation to avoid accidental deletes
      const confirmed = confirm('Are you sure you want to delete this service? This action cannot be undone.');
      if (!confirmed) return;

      try {
        await deleteDoc(doc(db, 'services', serviceId));
        await loadAdminServices();
        serviceStatus.textContent = 'Service deleted successfully.';
      } catch (error) {
        serviceStatus.textContent = error.message;
      }
    });
  });

  servicesList.querySelectorAll('button[data-edit-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const serviceId = button.dataset.editId;
      const service = uniqueServices.find((item) => item.id === serviceId);
      if (!service) return;
      populateServiceForm(service);
      serviceForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      serviceStatus.textContent = `Editing ${service.name}.`;
    });
  });
}

async function loadAdminServices() {
  if (!servicesList) return;

  try {
    const snapshot = await getDocs(query(collection(db, 'services'), orderBy('createdAt', 'desc')));
    const services = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    servicesCache = services;
    applyServiceFilters();
  } catch (error) {
    servicesList.innerHTML = `<p class="small">Unable to load services: ${error.message}</p>`;
  }
}

function applyServiceFilters() {
  let items = servicesCache.slice();
  const q = serviceSearch && serviceSearch.value ? serviceSearch.value.trim().toLowerCase() : '';
  const cat = serviceFilterCategory && serviceFilterCategory.value ? serviceFilterCategory.value : '';

  if (cat) {
    items = items.filter((s) => (s.category || '').toLowerCase() === cat.toLowerCase());
  }

  if (q) {
    items = items.filter((s) => {
      const hay = `${s.name || ''} ${s.description || ''} ${s.category || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }

  renderServiceCards(items);
}

async function isAdmin(user) {
  if (!user) return false;
  console.log('Admin check user:', { uid: user.uid, email: user.email });
  try {
    let queryRef = query(collection(db, 'users'), where('uid', '==', user.uid), where('role', '==', 'admin'));
    let snapshot = await getDocs(queryRef);
    if (!snapshot.empty) return true;

    if (user.email) {
      queryRef = query(collection(db, 'users'), where('email', '==', user.email), where('role', '==', 'admin'));
      snapshot = await getDocs(queryRef);
      if (!snapshot.empty) return true;
    }

    console.warn('No admin role found for signed-in user:', { uid: user.uid, email: user.email });
    return false;
  } catch (error) {
    console.error('Admin check failed:', error);
    return false;
  }
}

async function handleSignOut() {
  await signOut(auth);
  window.location.href = '../index.html';
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    showSection(adminUnauthenticated);
    if (headerLogoutBtn) headerLogoutBtn.classList.add('hidden');
    return;
  }

  const admin = await isAdmin(user);
  if (!admin) {
    showSection(adminUnauthorized);
    if (headerLogoutBtn) headerLogoutBtn.classList.add('hidden');
    return;
  }

  adminWelcome.textContent = `Welcome, ${user.email}`;
  if (headerLogoutBtn) headerLogoutBtn.classList.remove('hidden');
  showSection(adminShell);
  await loadAdminServices();
  await loadAdminMetrics();
});

if (headerLogoutBtn) {
  headerLogoutBtn.addEventListener('click', handleSignOut);
}

if (serviceForm) {
  serviceForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('service-name').value.trim();
    const category = document.getElementById('service-category').value.trim();
    const price = document.getElementById('service-price').value.trim();
    const delivery = document.getElementById('service-delivery').value.trim();
    const description = document.getElementById('service-description').value.trim();
    const featured = document.getElementById('service-featured').checked;

    if (!name || !category || !price || !delivery) {
      serviceStatus.textContent = 'Please fill in all required fields.';
      return;
    }

    try {
      if (editingServiceId) {
        await updateDoc(doc(db, 'services', editingServiceId), {
          name,
          category,
          price,
          delivery,
          description,
          featured,
          updatedAt: serverTimestamp()
        });
        serviceStatus.textContent = 'Service updated successfully.';
      } else {
        await addDoc(collection(db, 'services'), {
          name,
          category,
          price,
          delivery,
          description,
          featured,
          rating: 4.5,
          createdAt: serverTimestamp()
        });
        serviceStatus.textContent = 'Service saved successfully.';
      }

      serviceForm.reset();
      editingServiceId = null;
      const submitButton = serviceForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.textContent = 'Save Service';
      }
      await loadAdminServices();
      await loadAdminMetrics();
    } catch (error) {
      serviceStatus.textContent = error.message;
    }
  });
}

// Wire up search and filter controls
if (serviceSearch) {
  serviceSearch.addEventListener('input', () => applyServiceFilters());
}
if (serviceFilterCategory) {
  serviceFilterCategory.addEventListener('change', () => applyServiceFilters());
}

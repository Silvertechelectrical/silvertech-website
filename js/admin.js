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
  updateDoc,
  doc,
  limit,
  startAfter
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-functions.js';

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
const loadMoreBtn = document.getElementById('load-more-btn');
const recentlyDeletedShell = document.getElementById('recently-deleted-shell');
const recentlyDeletedList = document.getElementById('recently-deleted-list');
const adminMetrics = document.getElementById('admin-metrics');
const roleAssignmentForm = document.getElementById('role-assignment-form');
const roleAssignmentStatus = document.getElementById('role-assignment-status');
const roleAssignmentEmailInput = document.getElementById('role-assignment-email');
const roleAssignmentPositionInput = document.getElementById('role-assignment-position');
const roleAssignmentRoleInput = document.getElementById('role-assignment-role');
const roleAssignmentPermissionInputs = Array.from(document.querySelectorAll('#permission-assignments input[type="checkbox"]'));

let currentUser = null;
let editingServiceId = null;
let servicesCache = [];
const PAGE_SIZE = 10;
let lastVisible = null;
let isFetching = false;

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

      const confirmed = confirm('Are you sure you want to delete this service? This action can be undone from the admin panel.');
      if (!confirmed) return;

      try {
        await updateDoc(doc(db, 'services', serviceId), {
          deleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: currentUser ? currentUser.uid : null
        });
        serviceStatus.innerHTML = `Service deleted. <button id="undo-delete" class="btn btn-outline small">Undo</button>`;
        const undoButton = document.getElementById('undo-delete');
        if (undoButton) {
          undoButton.addEventListener('click', async () => {
            await updateDoc(doc(db, 'services', serviceId), {
              deleted: false,
              deletedAt: null,
              deletedBy: null
            });
            serviceStatus.textContent = 'Delete undone.';
            await loadAdminServices(false);
          });
        }
        await loadAdminServices(false);
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

function getSelectedPermissions() {
  return roleAssignmentPermissionInputs
    .filter((input) => input.checked)
    .map((input) => input.value);
}

function setPermissionValues(values = []) {
  roleAssignmentPermissionInputs.forEach((input) => {
    input.checked = values.includes(input.value);
  });
}

function renderEmailOptions(emails = []) {
  const dataList = document.getElementById('role-email-options');
  if (!dataList) return;
  dataList.innerHTML = emails
    .filter(Boolean)
    .map((email) => `<option value="${email}">`)
    .join('');
}

function renderRoleOptions(roles = []) {
  const dataList = document.getElementById('role-name-options');
  if (!dataList) return;

  const predefinedRoles = ['user', 'developer', 'digital_lead', 'it_support', 'sales_ops_manager', 'sales_associate', 'engineering_lead', 'field_technician', 'junior_technician', 'managing_director'];
  const combinedRoles = Array.from(new Set([...predefinedRoles, ...roles.filter(Boolean)]))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  dataList.innerHTML = combinedRoles.map((role) => `<option value="${role}">`).join('');
}

async function loadRoleOptions() {
  try {
    const snapshot = await getDocs(query(collection(db, 'role-positions'), orderBy('role'), limit(200)));
    const roles = snapshot.docs
      .map((docSnap) => docSnap.data()?.role)
      .filter((role) => typeof role === 'string' && role.trim());
    renderRoleOptions(roles);
  } catch (error) {
    console.warn('Unable to load role suggestions:', error);
    renderRoleOptions();
  }
}

async function loadUserEmails() {
  // Prefer listing from Firebase Authentication via callable function (requires deployed functions)
  try {
    const functions = getFunctions();
    const listUsers = httpsCallable(functions, 'listAuthUsers');
    const result = await listUsers();
    const users = Array.isArray(result.data?.users) ? result.data.users : [];
    const emails = users
      .map((u) => u.email)
      .filter((email) => typeof email === 'string')
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    if (emails.length) {
      renderEmailOptions([...new Set(emails)]);
      return;
    }
  } catch (err) {
    // fall back to Firestore users collection
    console.warn('Auth listUsers callable failed or not available, falling back to Firestore:', err?.message || err);
  }

  try {
    const snapshot = await getDocs(query(collection(db, 'users'), orderBy('email'), limit(200)));
    const emails = snapshot.docs
      .map((doc) => doc.data()?.email)
      .filter((email) => typeof email === 'string')
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    renderEmailOptions([...new Set(emails)]);
  } catch (error) {
    console.warn('Unable to load user email options from Firestore:', error);
  }
}

async function prefillRoleData(email) {
  const address = (email || '').trim();
  if (!address) return;

  try {
    const snapshot = await getDocs(query(collection(db, 'users'), where('email', '==', address), limit(1)));
    if (snapshot.empty) {
      roleAssignmentStatus.textContent = 'No saved profile found for that email.';
      return;
    }

    const userDoc = snapshot.docs[0].data();
    if (roleAssignmentRoleInput) {
      roleAssignmentRoleInput.value = userDoc.role || '';
    }
    roleAssignmentPositionInput.value = userDoc.position || '';
    setPermissionValues(Array.isArray(userDoc.permissions) ? userDoc.permissions : []);
    roleAssignmentStatus.textContent = `Loaded profile for ${address}.`;
  } catch (error) {
    console.warn('Unable to prefill role data:', error);
    roleAssignmentStatus.textContent = 'Unable to load saved profile data.';
  }
}

async function loadAdminServices(append = false) {
  if (!servicesList || isFetching) return;
  isFetching = true;

  try {
    let servicesQuery = query(collection(db, 'services'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    if (append && lastVisible) {
      servicesQuery = query(collection(db, 'services'), orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
    }

    const snapshot = await getDocs(servicesQuery);
    if (!snapshot.empty) {
      lastVisible = snapshot.docs[snapshot.docs.length - 1];
    } else {
      lastVisible = null;
    }

    const services = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    servicesCache = append ? servicesCache.concat(services) : services;
    applyServiceFilters();
    renderDeletedServices(servicesCache);
    if (lastVisible && loadMoreBtn) {
      loadMoreBtn.classList.remove('hidden');
    } else if (loadMoreBtn) {
      loadMoreBtn.classList.add('hidden');
    }
  } catch (error) {
    servicesList.innerHTML = `<p class="small">Unable to load services: ${error.message}</p>`;
  } finally {
    isFetching = false;
  }
}

function applyServiceFilters() {
  let items = servicesCache.slice();
  const q = serviceSearch && serviceSearch.value ? serviceSearch.value.trim().toLowerCase() : '';
  const cat = serviceFilterCategory && serviceFilterCategory.value ? serviceFilterCategory.value : '';

  items = items.filter((service) => !service.deleted);

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
    let queryRef = query(collection(db, 'users'), where('uid', '==', user.uid), where('role', '==', 'managing_director'));
    let snapshot = await getDocs(queryRef);
    if (!snapshot.empty) return true;

    if (user.email) {
      queryRef = query(collection(db, 'users'), where('email', '==', user.email), where('role', '==', 'managing_director'));
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
  await loadUserEmails();
  await loadRoleOptions();
  await loadAdminServices();
  await loadAdminMetrics();
});

if (headerLogoutBtn) {
  headerLogoutBtn.addEventListener('click', handleSignOut);
}

if (roleAssignmentForm) {
  roleAssignmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const email = (roleAssignmentEmailInput?.value || '').trim();
    const role = (roleAssignmentRoleInput?.value || '').trim();
    const position = (roleAssignmentPositionInput?.value || '').trim();
    const permissions = getSelectedPermissions();

    if (!email || !role) {
      roleAssignmentStatus.textContent = 'Email and role are required.';
      roleAssignmentStatus.style.color = '#ff7b7b';
      return;
    }

    try {
      // Find the user document by email
      const snapshot = await getDocs(query(collection(db, 'users'), where('email', '==', email), limit(1)));
      if (snapshot.empty) {
        roleAssignmentStatus.textContent = `No user found with email: ${email}. Create the account first.`;
        roleAssignmentStatus.style.color = '#ff7b7b';
        return;
      }

      const userDocRef = snapshot.docs[0].ref;
      
      // Update the user document with new role, position, and permissions
      await updateDoc(userDocRef, {
        role,
        position,
        permissions,
        updatedAt: serverTimestamp()
      });

      roleAssignmentStatus.textContent = `Role assignment saved for ${email}: ${role}`;
      roleAssignmentStatus.style.color = '#00D4FF';
      
      // Refresh lists
      await loadUserEmails();
      await loadRoleOptions();
    } catch (error) {
      roleAssignmentStatus.textContent = `Error saving role assignment: ${error.message}`;
      roleAssignmentStatus.style.color = '#ff7b7b';
    }
  });
}

if (roleAssignmentEmailInput) {
  roleAssignmentEmailInput.addEventListener('change', async () => {
    await prefillRoleData(roleAssignmentEmailInput.value);
  });
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
          deleted: false,
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
      await loadAdminServices(false);
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
if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => loadAdminServices(true));
}

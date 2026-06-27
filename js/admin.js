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
  doc
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const adminLoading = document.getElementById('admin-loading');
const adminUnauthenticated = document.getElementById('admin-unauthenticated');
const adminUnauthorized = document.getElementById('admin-unauthorized');
const adminShell = document.getElementById('admin-shell');
const adminWelcome = document.getElementById('admin-welcome');
const logoutBtn = document.getElementById('logoutBtn');
const serviceForm = document.getElementById('admin-service-form');
const serviceStatus = document.getElementById('admin-service-status');
const servicesList = document.getElementById('admin-services-list');

let currentUser = null;

function showSection(section) {
  [adminLoading, adminUnauthenticated, adminUnauthorized, adminShell].forEach((el) => {
    if (!el) return;
    el.classList.add('hidden');
  });

  if (section) {
    section.classList.remove('hidden');
  }
}

function renderServiceCards(items) {
  if (!servicesList) return;

  if (!items.length) {
    servicesList.innerHTML = '<p class="small">No services found. Add one from the form above.</p>';
    return;
  }

  servicesList.innerHTML = items
    .map((service) => `
      <article class="service-card">
        <div class="service-top">
          <h3>${service.name}</h3>
        </div>
        <p class="meta">${service.category}</p>
        <p>${service.description}</p>
        <p class="meta">Price: ${service.price} KSH</p>
        <button class="btn btn-secondary" data-id="${service.id}" type="button">Delete</button>
      </article>
    `)
    .join('');

  servicesList.querySelectorAll('button[data-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const serviceId = button.dataset.id;
      if (!serviceId) return;

      try {
        await deleteDoc(doc(db, 'services', serviceId));
        await loadAdminServices();
        serviceStatus.textContent = 'Service deleted successfully.';
      } catch (error) {
        serviceStatus.textContent = error.message;
      }
    });
  });
}

async function loadAdminServices() {
  if (!servicesList) return;

  try {
    const snapshot = await getDocs(query(collection(db, 'services'), orderBy('createdAt', 'desc')));
    const services = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderServiceCards(services);
  } catch (error) {
    servicesList.innerHTML = `<p class="small">Unable to load services: ${error.message}</p>`;
  }
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

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    showSection(adminUnauthenticated);
    return;
  }

  const admin = await isAdmin(user);
  if (!admin) {
    showSection(adminUnauthorized);
    return;
  }

  adminWelcome.textContent = `Welcome, ${user.email}`;
  showSection(adminShell);
  await loadAdminServices();
});

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = '../index.html';
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
      serviceForm.reset();
      await loadAdminServices();
    } catch (error) {
      serviceStatus.textContent = error.message;
    }
  });
}

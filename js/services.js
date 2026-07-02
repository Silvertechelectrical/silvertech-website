import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { isAdminUser } from './role-utils.js';

const fallbackServices = [
  {
    name: 'Telecom Audit',
    category: 'Telecom',
    price: '4500',
    description: 'Site readiness and connectivity assessment for SMEs and offices.',
    featured: true,
    rating: 4.8,
    delivery: 'Same day'
  },
  {
    name: 'Electrical Maintenance',
    category: 'Electrical',
    price: '6000',
    description: 'Preventive maintenance plans for lighting, sockets and backup systems.',
    featured: false,
    rating: 4.6,
    delivery: 'Scheduled'
  }
];

let allServices = [];

function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item?.id || ''}:${item?.name || ''}:${item?.category || ''}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function saveHistory(name, type) {
  const history = JSON.parse(localStorage.getItem('silvertech-history') || '[]');
  history.unshift({ name, type, at: new Date().toLocaleString() });
  localStorage.setItem('silvertech-history', JSON.stringify(history.slice(0, 8)));
}

let currentUser = null;
const addServiceButton = document.getElementById('services-add-button');

async function updateServiceAccess(user) {
  if (!addServiceButton) return;

  addServiceButton.classList.add('hidden');
  if (!user) return;

  try {
    const admin = await isAdminUser(user);
    if (admin) {
      addServiceButton.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error checking service admin status:', error);
  }
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateServiceAccess(user);
});

async function submitServiceRequest(serviceName, customerPhoneNumber) {
  if (!currentUser) {
    sessionStorage.setItem('redirectAfterLogin', window.location.href);
    window.location.href = '../pages/login.html';
    return false;
  }

  if (!customerPhoneNumber) {
    alert('Please enter a phone number to submit your request.');
    return false;
  }

  const requestPayload = {
    userId: currentUser.uid,
    serviceName,
    customerPhoneNumber,
    status: 'pending',
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, 'requests'), requestPayload);
    saveHistory(serviceName, 'request');
    document.getElementById('request-status').textContent = 'Request submitted successfully. We will contact you soon.';
    return true;
  } catch (error) {
    console.error('Error creating request:', error);
    document.getElementById('request-status').textContent = 'Unable to submit request. Please try again later.';
    return false;
  }
}

function renderServices(items) {
  const list = document.getElementById('services-list');
  if (!list) return;

  list.innerHTML = '';

  if (!items.length) {
    list.innerHTML = '<p class="small">No services match your search right now.</p>';
    return;
  }

  const uniqueItems = dedupeItems(items);

  uniqueItems.forEach((service) => {
    const card = document.createElement('article');
    const rating = Number(service.rating || 0);
    const displayRating = Number.isFinite(rating) ? rating.toFixed(1) : '4.5';
    const categoryKey = String(service.category || 'ELECTRICAL').toUpperCase();

    card.className = 'service-card';
    card.innerHTML = `
      <img src="../assets/img/${categoryKey}.png" width="80" alt="${service.name}" onerror="this.onerror=null;this.src='../assets/img/usablesilvertech.jpg';">
      <div class="service-top">
        <h3>${service.name}</h3>
        ${service.featured ? '<span class="pill">Featured</span>' : ''}
      </div>
      <p class="meta">${service.category}</p>
      <p>${service.description || 'Premium professional delivery.'}</p>
      <p class="meta">Delivery: ${service.delivery || 'Scheduled'}</p>
      <div class="service-price">${service.price} KSH</div>
      <div class="stars" aria-label="Rating ${displayRating}">
        ${[1,2,3,4,5].map((value) => `<button class="star-btn" data-value="${value}" aria-label="Rate ${value} stars"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.75l2.56 5.2 5.74.83-4.15 4.04 1.0 5.68L12 15.98 6.85 18.5l1.0-5.68L3.7 8.78l5.74-.83L12 2.75Z"/></svg></button>`).join('')}
        <span class="small">${displayRating}</span>
      </div>
      <button class="request-btn">Request Service</button>
    `;

    card.querySelector('.request-btn').addEventListener('click', async () => {
      if (!currentUser) {
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.href = '../pages/login.html';
        return;
      }

      const select = document.getElementById('request-service-name');
      if (select) {
        select.value = service.name;
      }
      document.getElementById('request-phone')?.focus();
      const phone = prompt('Enter your phone number to submit this service request:');
      if (phone) {
        await submitServiceRequest(service.name, phone.trim());
      }
    });
    card.querySelectorAll('.star-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        card.querySelectorAll('.star-btn').forEach((item) => item.classList.toggle('active', Number(item.dataset.value) <= Number(btn.dataset.value)));
      });
    });

    list.appendChild(card);
  });
}

async function loadServices() {
  const list = document.getElementById('services-list');
  const searchInput = document.getElementById('service-search');

  try {
    const querySnapshot = await getDocs(collection(db, 'services'));
    allServices = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (!allServices.length) {
      allServices = fallbackServices;
    } else {
      allServices = allServices.sort((a, b) => Number(b.featured || false) - Number(a.featured || false));
    }
  } catch (error) {
    console.error('Error loading services:', error);
    allServices = fallbackServices;
  }

  renderServices(allServices);
  populateRequestOptions(allServices);

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      const query = event.target.value.toLowerCase();
      const filtered = allServices.filter((service) => `${service.name} ${service.category} ${service.description}`.toLowerCase().includes(query));
      renderServices(filtered);
      populateRequestOptions(filtered);
    });
  }

  const requestForm = document.getElementById('service-request-form');
  if (requestForm) {
    requestForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const serviceName = document.getElementById('request-service-name').value;
      const phone = document.getElementById('request-phone').value.trim();
      await submitServiceRequest(serviceName, phone);
      requestForm.reset();
    });
  }

  if (list) {
    list.className = 'services-grid';
  }
}

function populateRequestOptions(items) {
  const select = document.getElementById('request-service-name');
  if (!select) return;

  const uniqueItems = dedupeItems(items);
  select.innerHTML = '<option value="">Select a service</option>' + uniqueItems.map((service) => `
    <option value="${service.name}">${service.name} (${service.category})</option>
  `).join('');
}

loadServices();
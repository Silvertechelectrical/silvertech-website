import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { isAdminUser, isSalesEngineerAdmin, isServiceProvider } from './role-utils.js';
import { uploadToCloudinary, FOLDERS } from './cloudinary-utils.js';

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
const servicesAddForm = document.getElementById('services-add-form');
const servicesAddToggle = document.getElementById('services-add-toggle');
const adminServiceForm = document.getElementById('admin-service-form');
const adminServiceStatus = document.getElementById('admin-service-status');
const detailDrawer = document.getElementById('service-drawer');
const detailShell = document.getElementById('service-detail-shell');

function getStoredUserRole(user) {
  if (!user) return null;
  try {
    const storedUser = sessionStorage.getItem('user');
    if (!storedUser) return null;
    const parsed = JSON.parse(storedUser);
    const role = String(parsed?.role || '').toLowerCase();
    return role || null;
  } catch (error) {
    return null;
  }
}

async function updateServiceAccess(user) {
  if (!user) {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    return;
  }

  try {
    const allowed = await canManageService(user);
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', !allowed);
    });
  } catch (error) {
    console.error('Error checking service admin status:', error);
  }
}

async function canManageService(user) {
  if (!user) return false;

  const storedRole = getStoredUserRole(user);
  if (['admin', 'service_provider', 'sales', 'sales_engineer', 'engineer'].includes(storedRole)) {
    return true;
  }

  const [isAdmin, isProvider, isSales] = await Promise.all([
    isAdminUser(user),
    isServiceProvider(user),
    isSalesEngineerAdmin(user)
  ]);
  return isAdmin || isProvider || isSales;
}

async function openServiceDrawer(service) {
  if (!detailDrawer || !detailShell) return;
  const imageUrls = Array.isArray(service?.images) && service.images.length
    ? service.images
    : service?.imageUrl
      ? [service.imageUrl]
      : [];
  const imageMarkup = imageUrls.length
    ? `<div class="detail-gallery">${imageUrls.map((url) => `<img class="detail-image" src="${url}" alt="${service.name}" onerror="this.onerror=null;this.src='../assets/img/usablesilvertech.jpg';">`).join('')}</div>`
    : '<img class="detail-image" src="../assets/img/usablesilvertech.jpg" alt="Service preview">';

  const canEdit = currentUser ? await canManageService(currentUser) : false;
  const actionButtons = `
    <div class="detail-actions">
      <button class="btn btn-primary" id="service-request-inline">Request Service</button>
      ${canEdit ? '<button class="btn btn-secondary" id="service-edit-inline">Edit Service</button>' : ''}
    </div>
  `;
  const editForm = canEdit ? `
    <form id="service-edit-form" class="admin-form-shell hidden">
      <p class="small">Edit service details and use the + button to upload marketing images to Cloudinary.</p>
      <label class="small" for="edit-service-name">Service name</label>
      <input id="edit-service-name" value="${(service.name || '').replace(/"/g, '&quot;')}" required>
      <label class="small" for="edit-service-price">Price</label>
      <input id="edit-service-price" value="${service.price || ''}" required>
      <label class="small" for="edit-service-delivery">Delivery timeline</label>
      <input id="edit-service-delivery" value="${(service.delivery || '').replace(/"/g, '&quot;')}" required>
      <label class="small" for="edit-service-description">Description</label>
      <textarea id="edit-service-description">${(service.description || '').replace(/"/g, '&quot;')}</textarea>
      <div class="upload-control">
        <button type="button" class="btn btn-secondary upload-plus-btn" id="service-upload-inline">+ Upload Image</button>
        <span id="edit-service-files-label" class="small">No files selected</span>
      </div>
      <input id="edit-service-images" type="file" accept="image/*" multiple class="hidden">
      <button type="submit">Save Changes</button>
    </form>
  ` : '';

  detailShell.innerHTML = `
    <div class="drawer-header">
      <h2>${service.name || 'Service'}</h2>
      <p class="meta">${service.category || 'Service'}</p>
      <p class="drawer-price">${service.price || '0'} KSH</p>
      ${actionButtons}
    </div>
    <p>${service.description || 'Premium professional delivery.'}</p>
    <p class="meta">Delivery: ${service.delivery || 'Scheduled'}</p>
    ${imageMarkup}
    ${editForm}
  `;

  detailDrawer.classList.add('open');
  detailDrawer.setAttribute('aria-hidden', 'false');

  document.getElementById('service-request-inline')?.addEventListener('click', async () => {
    const phone = prompt('Enter your phone number to submit this service request:');
    if (phone) {
      await submitServiceRequest(service.name, phone.trim());
    }
  });

  document.getElementById('service-edit-inline')?.addEventListener('click', () => {
    const form = document.getElementById('service-edit-form');
    if (form) {
      form.classList.remove('hidden');
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  document.getElementById('service-upload-inline')?.addEventListener('click', () => {
    document.getElementById('edit-service-images')?.click();
  });

  document.getElementById('edit-service-images')?.addEventListener('change', (event) => {
    const input = event.target;
    const files = Array.from(input.files || []);
    const label = document.getElementById('edit-service-files-label');
    if (label) {
      label.textContent = files.length ? `${files.length} file(s) selected` : 'No files selected';
    }
  });

  document.getElementById('service-edit-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentUser || !(await canManageService(currentUser))) return;

    const updatedName = document.getElementById('edit-service-name').value.trim();
    const updatedPrice = document.getElementById('edit-service-price').value.trim();
    const updatedDelivery = document.getElementById('edit-service-delivery').value.trim();
    const updatedDescription = document.getElementById('edit-service-description').value.trim();
    const files = Array.from(document.getElementById('edit-service-images').files || []);

    try {
      const uploadedImages = [];
      for (const file of files) {
        const uploadResult = await uploadToCloudinary(file, FOLDERS.MARKETING);
        uploadedImages.push(uploadResult.secure_url);
      }

      const updatePayload = {
        name: updatedName,
        price: updatedPrice,
        delivery: updatedDelivery,
        description: updatedDescription,
        updatedAt: serverTimestamp()
      };

      if (uploadedImages.length) {
        updatePayload.imageUrl = uploadedImages[0];
        updatePayload.images = uploadedImages;
        updatePayload.marketingImages = uploadedImages;
      }

      await updateDoc(doc(db, 'services', service.id), updatePayload);
      adminServiceStatus.textContent = 'Service updated successfully.';
      await loadServices();
      openServiceDrawer({ ...service, ...updatePayload });
    } catch (error) {
      adminServiceStatus.textContent = `Error: ${error.message}`;
    }
  });
}

function closeServiceDrawer() {
  if (!detailDrawer) return;
  detailDrawer.classList.remove('open');
  detailDrawer.setAttribute('aria-hidden', 'true');
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateServiceAccess(user);
});

if (servicesAddToggle) {
  servicesAddToggle.addEventListener('click', () => {
    if (servicesAddForm) {
      servicesAddForm.classList.toggle('hidden');
    }
  });
}

if (adminServiceForm) {
  adminServiceForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentUser) {
      adminServiceStatus.textContent = 'You must be logged in to add services.';
      return;
    }

    const name = document.getElementById('service-name').value.trim();
    const category = document.getElementById('service-category').value.trim();
    const price = document.getElementById('service-price').value.trim();
    const delivery = document.getElementById('service-delivery').value.trim();
    const description = document.getElementById('service-description').value.trim();
    const featured = document.getElementById('service-featured').checked;
    const imageFiles = Array.from(document.getElementById('service-images').files || []);

    if (!name || !category || !price || !delivery) {
      adminServiceStatus.textContent = 'Please fill in all required fields.';
      return;
    }

    try {
      const uploadedImages = [];
      for (const file of imageFiles) {
        const uploadResult = await uploadToCloudinary(file, FOLDERS.MARKETING);
        uploadedImages.push(uploadResult.secure_url);
      }

      await addDoc(collection(db, 'services'), {
        name,
        category,
        price,
        delivery,
        description,
        featured,
        imageUrl: uploadedImages[0] || null,
        images: uploadedImages,
        marketingImages: uploadedImages,
        rating: 4.5,
        deleted: false,
        createdAt: serverTimestamp()
      });
      adminServiceStatus.textContent = 'Service added successfully!';
      adminServiceForm.reset();
      if (servicesAddForm) servicesAddForm.classList.add('hidden');
    } catch (error) {
      adminServiceStatus.textContent = `Error: ${error.message}`;
    }
  });
}

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
    const previewImage = Array.isArray(service.images) && service.images.length
      ? service.images[0]
      : service.imageUrl || `../assets/img/${String(service.category || 'ELECTRICAL').toUpperCase()}.png`;

    card.className = 'service-card';
    card.innerHTML = `
      <img src="${previewImage}" width="80" alt="${service.name}" onerror="this.onerror=null;this.src='../assets/img/usablesilvertech.jpg';">
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

    card.addEventListener('click', (event) => {
      if (event.target.closest('.request-btn, .star-btn')) return;
      openServiceDrawer(service);
    });

    card.querySelector('.request-btn').addEventListener('click', async (event) => {
      event.stopPropagation();
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

  document.querySelectorAll('[data-close-drawer]').forEach((button) => {
    button.addEventListener('click', closeServiceDrawer);
  });

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
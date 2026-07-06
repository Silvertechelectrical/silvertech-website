import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { collection, getDocs, addDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { isAdminUser } from './role-utils.js';
import { uploadToCloudinary, FOLDERS } from './cloudinary-utils.js';

const manageButton = document.getElementById('shop-manage-button');
const shopAddForm = document.getElementById('shop-add-form');
const shopAddToggle = document.getElementById('shop-add-toggle');
const shopUploadForm = document.getElementById('shop-upload-form');
const uploadStatus = document.getElementById('upload-status');

async function updateShopManageButton(user) {
  if (!user) {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    return;
  }

  try {
    const isAdmin = await isAdminUser(user);
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', !isAdmin);
    });
  } catch (error) {
    console.error('Error checking shop manager status:', error);
  }
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateShopManageButton(user);
});

if (shopAddToggle) {
  shopAddToggle.addEventListener('click', () => {
    if (shopAddForm) {
      shopAddForm.classList.toggle('hidden');
    }
  });
}

if (shopUploadForm) {
  shopUploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentUser) {
      uploadStatus.textContent = 'You must be logged in to add items.';
      return;
    }

    const name = document.getElementById('item-name').value.trim();
    const category = document.getElementById('item-category').value.trim();
    const price = document.getElementById('item-price').value.trim();
    const description = document.getElementById('item-description').value.trim();
    const file = document.getElementById('item-file').files[0];
    const featured = document.getElementById('item-featured').checked;

    if (!name || !category || !price || !description || !file) {
      uploadStatus.textContent = 'Please fill in all required fields.';
      return;
    }

    try {
      uploadStatus.textContent = 'Uploading file...';
      const fileUrl = await uploadToCloudinary(file, FOLDERS.MARKETING);

      await addDoc(collection(db, 'shop'), {
        name,
        category,
        price,
        description,
        fileUrl: fileUrl.secure_url,
        featured,
        published: false,
        uploadedBy: currentUser.uid,
        uploadedByEmail: currentUser.email,
        createdAt: serverTimestamp(),
        rating: 4.5
      });

      uploadStatus.textContent = 'Item added successfully! Awaiting admin approval.';
      shopUploadForm.reset();
      if (shopAddForm) shopAddForm.classList.add('hidden');
    } catch (error) {
      uploadStatus.textContent = `Error: ${error.message}`;
    }
  });
}

const fallbackItems = [
  {
    name: 'Network Audit Template',
    category: 'Templates',
    price: '2500',
    description: 'Ready-to-use site audit checklist for network assessments.',
    featured: true,
    rating: 4.8,
    downloadFormat: 'PDF'
  },
  {
    name: 'Electrical Maintenance Schedule',
    category: 'Templates',
    price: '1500',
    description: 'Preventive maintenance tracking sheet and guidelines.',
    featured: false,
    rating: 4.5,
    downloadFormat: 'Excel'
  },
  {
    name: 'Field Technician Handbook',
    category: 'Digital Assets',
    price: '3500',
    description: 'Comprehensive guide for electrical and telecom field operations.',
    featured: true,
    rating: 4.9,
    downloadFormat: 'PDF'
  }
];

let allItems = [];
let currentUser = null;

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

async function submitPurchaseRequest(itemName, customerEmail, customerPhone) {
  if (!customerEmail || !customerPhone) {
    alert('Please provide both email and phone number.');
    return false;
  }

  const requestPayload = {
    itemName,
    customerEmail,
    customerPhone,
    status: 'pending',
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, 'shop-purchases'), requestPayload);
    saveHistory(itemName, 'purchase');
    document.getElementById('purchase-status').textContent = 'Purchase request submitted! We will send download details to your email.';
    return true;
  } catch (error) {
    console.error('Error creating purchase request:', error);
    document.getElementById('purchase-status').textContent = 'Unable to submit request. Please try again later.';
    return false;
  }
}

function renderShopItems(items) {
  const list = document.getElementById('shop-items');
  if (!list) return;

  list.innerHTML = '';

  if (!items.length) {
    list.innerHTML = '<p class="small">No items match your search right now.</p>';
    return;
  }

  const uniqueItems = dedupeItems(items);

  uniqueItems.forEach((item) => {
    const card = document.createElement('article');
    const rating = Number(item.rating || 0);
    const displayRating = Number.isFinite(rating) ? rating.toFixed(1) : '4.5';
    const categoryKey = String(item.category || 'TEMPLATES').toUpperCase().replace(/ /g, '');

    card.className = 'service-card';
    card.innerHTML = `
      <img src="../assets/img/${categoryKey}.png" width="80" alt="${item.name}" onerror="this.onerror=null;this.src='../assets/img/usablesilvertech.jpg';">
      <div class="service-top">
        <h3>${item.name}</h3>
        ${item.featured ? '<span class="pill">Featured</span>' : ''}
      </div>
      <div class="meta-badges">
        <span class="meta-badge">${item.category}</span>
        <span class="meta-badge format-badge">${item.downloadFormat || 'Digital'}</span>
      </div>
      <p>${item.description || 'Premium resource.'}</p>
      <div class="service-price">${item.price} KSH</div>
      <div class="stars" aria-label="Rating ${displayRating}">
        ${[1,2,3,4,5].map((value) => `<button class="star-btn" data-value="${value}" aria-label="Rate ${value} stars"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.75l2.56 5.2 5.74.83-4.15 4.04 1.0 5.68L12 15.98 6.85 18.5l1.0-5.68L3.7 8.78l5.74-.83L12 2.75Z"/></svg></button>`).join('')}
        <span class="small">${displayRating}</span>
      </div>
      <button class="request-btn">Purchase Now</button>
    `;

    card.querySelector('.request-btn').addEventListener('click', () => {
      const drawer = document.getElementById('purchase-drawer');
      const select = document.getElementById('purchase-item-name');
      const emailInput = document.getElementById('purchase-email');
      const phoneInput = document.getElementById('purchase-phone');
      if (drawer) {
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
      }
      if (select) {
        select.value = item.name;
      }
      if (emailInput && currentUser?.email) {
        emailInput.value = currentUser.email;
      }
      if (phoneInput && currentUser?.phoneNumber) {
        phoneInput.value = currentUser.phoneNumber;
      }
      emailInput?.focus();
    });

    card.querySelectorAll('.star-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        card.querySelectorAll('.star-btn').forEach((item) => item.classList.toggle('active', Number(item.dataset.value) <= Number(btn.dataset.value)));
      });
    });

    list.appendChild(card);
  });
}

async function loadShopItems() {
  const searchInput = document.getElementById('shop-search');

  try {
    // Load only published items (no auth required)
    const q = query(collection(db, 'shop'), where('published', '==', true));
    const querySnapshot = await getDocs(q);
    allItems = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (!allItems.length) {
      allItems = fallbackItems;
    } else {
      allItems = allItems.sort((a, b) => Number(b.featured || false) - Number(a.featured || false));
    }
  } catch (error) {
    console.error('Error loading shop items:', error);
    allItems = fallbackItems;
  }

  renderShopItems(allItems);
  populatePurchaseOptions(allItems);

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      const query = event.target.value.toLowerCase();
      const filtered = allItems.filter((item) => `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(query));
      renderShopItems(filtered);
      populatePurchaseOptions(filtered);
    });
  }

  const purchaseForm = document.getElementById('purchase-form');
  if (purchaseForm) {
    purchaseForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const itemName = document.getElementById('purchase-item-name').value;
      const email = document.getElementById('purchase-email').value.trim();
      const phone = document.getElementById('purchase-phone').value.trim();
      await submitPurchaseRequest(itemName, email, phone);
      purchaseForm.reset();
    });
  }
}

function populatePurchaseOptions(items) {
  const select = document.getElementById('purchase-item-name');
  if (!select) return;

  const uniqueItems = dedupeItems(items);
  select.innerHTML = '<option value="">Select an item</option>' + uniqueItems.map((item) => `
    <option value="${item.name}">${item.name} (${item.price} KSH)</option>
  `).join('');
}

const drawer = document.getElementById('purchase-drawer');
if (drawer) {
  drawer.querySelectorAll('[data-close-drawer]').forEach((control) => {
    control.addEventListener('click', () => {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    });
  });
}

loadShopItems();

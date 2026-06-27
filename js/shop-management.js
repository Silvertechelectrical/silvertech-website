import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { collection, addDoc, getDocs, query, where, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { isAdminUser, isApprovedDeveloper } from './role-utils.js';

let currentUser = null;
const cloudinaryConfig = window.CLOUDINARY_CONFIG || { cloudName: 'dkv7a8rcm', uploadPreset: 'my_silvertechelectrical_preset' };

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!currentUser) {
    sessionStorage.setItem('redirectAfterLogin', window.location.href);
    window.location.href = '../pages/login.html';
    return;
  }

  // Check if user is authorized to upload (in developers collection)
  const isAdmin = await isAdminUser(currentUser);
  const isDeveloper = await isApprovedDeveloper(currentUser);

  if (!isAdmin && !isDeveloper) {
    document.body.innerHTML = '<main class="page-shell"><h1>Access Denied</h1><p>You are not authorized to manage shop items. Please contact an administrator.</p><a href="dashboard.html">Back to Dashboard</a></main>';
    return;
  }

  loadUserShopItems();
});

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Cloudinary error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

async function submitShopItem(formData) {
  if (!currentUser) {
    alert('Please log in to upload items.');
    return false;
  }

  const file = document.getElementById('item-file').files[0];
  if (!file) {
    alert('Please select a file to upload.');
    return false;
  }

  const statusEl = document.getElementById('upload-status');

  try {
    statusEl.textContent = 'Uploading file...';
    const fileUrl = await uploadToCloudinary(file);

    statusEl.textContent = 'Saving item details...';
    const itemPayload = {
      name: formData.get('name'),
      category: formData.get('category'),
      description: formData.get('description'),
      price: formData.get('price'),
      downloadFormat: formData.get('format') || 'Digital',
      featured: formData.get('featured') === 'on',
      fileUrl,
      uploadedBy: currentUser.uid,
      uploadedByEmail: currentUser.email,
      published: false, // Admin must approve before public
      createdAt: serverTimestamp(),
      rating: 4.5
    };

    await addDoc(collection(db, 'shop'), itemPayload);
    statusEl.textContent = 'Item uploaded successfully! Awaiting admin approval.';
    document.getElementById('shop-upload-form').reset();
    loadUserShopItems();
    return true;
  } catch (error) {
    console.error('Error uploading item:', error);
    statusEl.textContent = `Upload failed: ${error.message}`;
    return false;
  }
}

function renderShopItem(item) {
  const card = document.createElement('article');
  const rating = Number(item.rating || 4.5).toFixed(1);
  
  const statusBadge = item.published 
    ? '<span class="pill" style="background-color: #4CAF50;">Published</span>'
    : '<span class="pill" style="background-color: #FFC107;">Pending Approval</span>';

  card.className = 'service-card';
  card.innerHTML = `
    <img src="${item.fileUrl}" width="80" alt="${item.name}" onerror="this.onerror=null;this.src='../assets/img/usablesilvertech.jpg';" style="object-fit: cover; height: 80px;">
    <div class="service-top">
      <h3>${item.name}</h3>
      ${statusBadge}
    </div>
    <p class="meta">${item.category}</p>
    <p>${item.description}</p>
    <p class="meta">Format: ${item.downloadFormat}</p>
    <p><strong>${item.price} KSH</strong></p>
    <div class="meta">
      <small>Rating: ${rating}/5</small>
    </div>
    <div style="display: flex; gap: 10px; margin-top: 10px;">
      <button class="edit-btn" data-id="${item.id}">Edit</button>
      <button class="delete-btn" data-id="${item.id}">Delete</button>
    </div>
  `;

  card.querySelector('.edit-btn').addEventListener('click', async () => {
    const newName = prompt('Item name:', item.name);
    if (newName) {
      await updateDoc(doc(db, 'shop', item.id), { name: newName });
      loadUserShopItems();
    }
  });

  card.querySelector('.delete-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteDoc(doc(db, 'shop', item.id));
      loadUserShopItems();
    }
  });

  return card;
}

async function loadUserShopItems() {
  const list = document.getElementById('shop-items-list');
  if (!list) return;

  try {
    const q = query(collection(db, 'shop'), where('uploadedBy', '==', currentUser.uid));
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    list.innerHTML = '';

    if (!items.length) {
      list.innerHTML = '<p class="small">You haven\'t uploaded any items yet.</p>';
      return;
    }

    items.forEach((item) => {
      list.appendChild(renderShopItem(item));
    });
  } catch (error) {
    console.error('Error loading items:', error);
    list.innerHTML = '<p class="small">Error loading items. Please try again.</p>';
  }
}

const uploadForm = document.getElementById('shop-upload-form');
if (uploadForm) {
  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(uploadForm);
    await submitShopItem(formData);
  });
}

import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import { isAdminUser, isDeveloperUser } from './role-utils.js';

const uploadShell = document.getElementById('upload-shell');
const uploadForm = document.getElementById('store-upload-form');
const uploadStatus = document.getElementById('listing-status');
let currentUser = null;

function showElement(element, show) {
  if (!element) return;
  element.classList.toggle('hidden', !show);
}

function redirectToLogin() {
  sessionStorage.setItem('redirectAfterLogin', window.location.href);
  window.location.href = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
}

if (auth) {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (!user) {
      showElement(uploadShell, false);
      redirectToLogin();
      return;
    }

    const isAdmin = await isAdminUser(user);
    const isDeveloper = await isDeveloperUser(user);

    if (!isAdmin && !isDeveloper) {
    document.body.innerHTML = '<main class="page-shell"><h1>Access Denied</h1><p>You are not authorized to upload store listings. Please contact an administrator.</p><a class="btn btn-secondary" href="store.html">Back to Store</a></main>';
    return;
    }

    showElement(uploadShell, true);
  });
} else {
  showElement(uploadShell, false);
  console.warn('Firebase auth is not initialized. Upload page cannot verify access.');
}

async function submitListing(event) {
  event.preventDefault();
  if (!currentUser) return redirectToLogin();

  const listingType = document.getElementById('listing-type').value;
  const name = document.getElementById('listing-name').value.trim();
  const category = document.getElementById('listing-category').value.trim();
  const price = Number(document.getElementById('listing-price').value);
  const description = document.getElementById('listing-description').value.trim();
  const imageFile = document.getElementById('listing-image').files[0];
  const assetFile = document.getElementById('listing-file').files[0];
  const notes = document.getElementById('listing-notes').value.trim();

  if (!name || !category || !description || !imageFile || !assetFile) {
    uploadStatus.textContent = 'Please fill in all required fields and upload both files.';
    return;
  }

  try {
    uploadStatus.textContent = 'Uploading listing...';
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('asset', assetFile);
    formData.append('upload_preset', 'my_silvertechelectrical_preset');

    const response = await fetch(`https://api.cloudinary.com/v1_1/dkv7a8rcm/auto/upload`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    if (!response.ok || !data.secure_url) {
      throw new Error(data.error?.message || 'Upload failed.');
    }

    const listingPayload = {
      name,
      type: listingType,
      category,
      price,
      description,
      imageUrl: data.secure_url,
      assetFileName: assetFile.name,
      notes,
      uploadedBy: currentUser.uid,
      uploadedByEmail: currentUser.email,
      status: 'pending',
      approved: false,
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'store-listings'), listingPayload);
    uploadStatus.textContent = 'Listing submitted successfully. Admin review is pending.';
    uploadForm.reset();
  } catch (error) {
    console.error('Listing upload failed:', error);
    uploadStatus.textContent = `Listing upload failed: ${error.message}`;
  }
}

if (uploadForm) {
  uploadForm.addEventListener('submit', submitListing);
}

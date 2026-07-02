import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import { isAdminUser, isApprovedDeveloper } from './role-utils.js';

const cloudinaryConfig = window.CLOUDINARY_CONFIG || {
  cloudName: '',
  uploadPreset: ''
};

const registrationForm = document.getElementById('registration-form');
const registrationStatus = document.getElementById('registration-status');
const statusBanner = document.getElementById('developer-status-banner');
const uploadPanel = document.getElementById('developer-upload-panel');
const registerButton = document.getElementById('register-developer-button');
const approvalPanel = document.getElementById('developer-approval-panel');
const applicationsList = document.getElementById('developer-applications-list');
const uploadForm = document.getElementById('developer-upload-form');
const statusEl = document.getElementById('developer-upload-status');
const uploadActionButton = document.getElementById('store-upload-action');
const verifyActionButton = document.getElementById('store-verify-action');
const registrationName = document.getElementById('reg-name');
const registrationEmail = document.getElementById('reg-email');

let currentUser = null;
let isAdmin = false;
let isDeveloper = false;

async function loadDeveloperApplications() {
  if (!applicationsList) return;

  try {
    const applicationQuery = query(collection(db, 'developer-applications'), where('status', '==', 'pending'));
    const snapshot = await getDocs(applicationQuery);
    const applications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (!applications.length) {
      applicationsList.innerHTML = '<p class="small">No pending developer applications at the moment.</p>';
      return;
    }

    applicationsList.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'developer-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Applicant Name</th>
          <th>Email Address</th>
          <th>M-Pesa Reference</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    applications.forEach((application) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${application.name}</td>
        <td>${application.email}</td>
        <td>${application.paymentReference}</td>
        <td>
          <button class="btn btn-secondary approve-btn" type="button">Approve</button>
          <button class="btn btn-outline reject-btn" type="button">Reject</button>
        </td>
      `;

      tbody.appendChild(row);

      const approveBtn = row.querySelector('.approve-btn');
      approveBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        try {
          await addDoc(collection(db, 'developers'), {
            uid: null,
            email: application.email,
            name: application.name,
            phone: application.phone,
            approvedAt: new Date().toISOString(),
            status: 'approved'
          });

          await updateDoc(doc(db, 'developer-applications', application.id), {
            status: 'approved',
            reviewedBy: currentUser.uid,
            reviewedAt: new Date().toISOString(),
            approvedEmail: application.email
          });

          await loadDeveloperApplications();
          alert(`Developer application for ${application.email} has been approved. The user can now sign in and upload assets with this email.`);
        } catch (error) {
          console.error('Failed to approve developer application:', error);
          alert('Approval failed. Check the console for details.');
        }
      });

      const rejectBtn = row.querySelector('.reject-btn');
      rejectBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        try {
          await updateDoc(doc(db, 'developer-applications', application.id), {
            status: 'rejected',
            reviewedBy: currentUser.uid,
            reviewedAt: new Date().toISOString()
          });
          await loadDeveloperApplications();
        } catch (error) {
          console.error('Failed to reject developer application:', error);
        }
      });

    });

    applicationsList.appendChild(table);
  } catch (error) {
    console.error('Failed to load developer applications:', error);
    applicationsList.innerHTML = '<p class="small">Unable to load applications. Please try again later.</p>';
  }
}

async function updateDeveloperAccess(user) {
  if (!uploadPanel || !approvalPanel) return;

  uploadPanel.classList.add('hidden');
  approvalPanel.classList.add('hidden');
  if (uploadActionButton) uploadActionButton.classList.add('hidden');
  if (verifyActionButton) verifyActionButton.classList.add('hidden');
  if (statusEl) statusEl.textContent = '';

  if (registerButton) {
    registerButton.classList.toggle('hidden', Boolean(user));
  }

  if (!user) {
    if (statusBanner) {
      statusBanner.classList.add('hidden');
    }
    return;
  }

  try {
    isDeveloper = await isApprovedDeveloper(user);
    isAdmin = await isAdminUser(user);

    uploadPanel.classList.toggle('hidden', !(isDeveloper || isAdmin));
    approvalPanel.classList.toggle('hidden', !isAdmin);

    if (uploadActionButton) {
      uploadActionButton.classList.toggle('hidden', !isDeveloper && !isAdmin);
      uploadActionButton.textContent = isAdmin ? 'Upload App' : 'Upload My Apps';
    }

    if (verifyActionButton) {
      verifyActionButton.classList.toggle('hidden', !isAdmin);
    }

    if (isAdmin) {
      await loadDeveloperApplications();
    }

    if (statusBanner) {
      if (isDeveloper || isAdmin) {
        statusBanner.textContent = isAdmin ? 'Account Status: Registered Creator' : 'Account Status: Registered Creator';
        statusBanner.classList.remove('hidden');
      } else {
        statusBanner.textContent = 'Account Status: Pending Verification';
        statusBanner.classList.remove('hidden');
      }
    }

    if (!isDeveloper && !isAdmin && statusEl) {
      statusEl.textContent = 'Only approved developers or admin users can upload assets.';
    }
  } catch (error) {
    console.error('Failed to verify developer access:', error);
    uploadPanel.classList.add('hidden');
    approvalPanel.classList.add('hidden');
  }
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user && registrationName && registrationEmail) {
    registrationName.value = user.displayName || '';
    registrationEmail.value = user.email || '';
    registrationName.classList.add('locked-input');
    registrationEmail.classList.add('locked-input');
    registrationName.setAttribute('disabled', 'disabled');
    registrationEmail.setAttribute('disabled', 'disabled');
  }
  await updateDeveloperAccess(user);
});

async function uploadToCloudinary(file) {
  if (!cloudinaryConfig.cloudName || cloudinaryConfig.cloudName === 'YOUR_CLOUD_NAME' || !cloudinaryConfig.uploadPreset || cloudinaryConfig.uploadPreset === 'YOUR_UNSIGNED_UPLOAD_PRESET') {
    throw new Error('Cloudinary is not configured yet.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);
  formData.append('resource_type', 'auto');

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`, {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message || 'Cloudinary upload failed.');
  }

  return result.secure_url || null;
}

if (registrationForm) {
  registrationForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const reference = document.getElementById('reg-reference').value.trim();

    if (!name || !email || !phone || !reference) {
      registrationStatus.textContent = 'Please complete all registration fields.';
      return;
    }

    try {
      registrationStatus.textContent = 'Submitting registration...';
      await addDoc(collection(db, 'developer-applications'), {
        name,
        email,
        phone,
        paymentReference: reference,
        fee: 300,
        status: 'pending',
        submittedAt: new Date().toISOString()
      });
      registrationStatus.textContent = 'Registration submitted successfully. Await admin approval. Sign in later with this same email to upload once approved.';
      registrationForm.reset();
    } catch (error) {
      console.error('Developer registration failed:', error);
      registrationStatus.textContent = 'Unable to submit registration. Please try again.';
    }
  });
}

if (uploadForm) {
  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!currentUser) {
      statusEl.textContent = 'Please sign in first.';
      return;
    }

    const file = document.getElementById('developer-file').files[0];
    const name = document.getElementById('developer-name').value.trim();
    const category = document.getElementById('developer-category').value.trim();
    const price = document.getElementById('developer-price').value.trim();
    const description = document.getElementById('developer-description').value.trim();

    if (!file || !name || !category || !price) {
      statusEl.textContent = 'Please choose a file and complete all required fields.';
      return;
    }

    try {
      statusEl.textContent = 'Uploading to Cloudinary...';
      const fileUrl = await uploadToCloudinary(file);

      const adminQuery = query(collection(db, 'users'), where('uid', '==', currentUser.uid), where('role', '==', 'admin'));
      const adminSnapshot = await getDocs(adminQuery);
      const isAdmin = !adminSnapshot.empty;

      await addDoc(collection(db, 'store-assets'), {
        name,
        category,
        price,
        description,
        fileUrl,
        fileName: file.name,
        uploadedBy: currentUser.uid,
        uploadedByEmail: currentUser.email,
        uploadedAt: new Date().toISOString(),
        approved: isAdmin,
        approvedBy: isAdmin ? currentUser.uid : null,
        approvedAt: isAdmin ? new Date().toISOString() : null
      });

      statusEl.textContent = isAdmin
        ? 'Asset uploaded and approved successfully.'
        : 'Asset uploaded successfully. Approval is required before it appears in the public store.';
      uploadForm.reset();
    } catch (error) {
      console.error('Asset upload failed:', error);
      statusEl.textContent = error.message;
    }
  });
}

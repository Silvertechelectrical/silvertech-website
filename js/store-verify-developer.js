import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import { isAdminUser, getUserProfile } from './role-utils.js';

const applicationShell = document.getElementById('developer-application-shell');
const approvalShell = document.getElementById('developer-approval-shell');
const applicationForm = document.getElementById('developer-application-form');
const statusBanner = document.getElementById('verify-status-banner');
const applicationsList = document.getElementById('developer-applications-list');
let currentUser = null;

function setBanner(message, isError = false) {
  if (!statusBanner) return;
  statusBanner.textContent = message;
  statusBanner.classList.toggle('hidden', !message);
  statusBanner.style.color = isError ? '#ff7b7b' : '';
}

function showElement(element, show) {
  if (!element) return;
  element.classList.toggle('hidden', !show);
}

async function loadApplications() {
  if (!applicationsList) return;

  try {
    const snapshot = await getDocs(query(collection(db, 'developer-applications'), where('status', '==', 'pending')));
    if (snapshot.empty) {
      applicationsList.innerHTML = '<p class="small">No pending developer applications at the moment.</p>';
      return;
    }

    applicationsList.innerHTML = '';
    snapshot.forEach((applicationDoc) => {
      const application = { id: applicationDoc.id, ...applicationDoc.data() };
      const card = document.createElement('article');
      card.className = 'service-card';
      card.innerHTML = `
        <h3>${application.name}</h3>
        <p class="meta">${application.email}</p>
        <p>${application.phone}</p>
        <p>Reference: ${application.paymentReference}</p>
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button class="btn btn-secondary approve-btn">Approve</button>
          <button class="btn btn-outline reject-btn">Reject</button>
        </div>
      `;

      card.querySelector('.approve-btn').addEventListener('click', async () => {
        try {
          await updateDoc(doc(db, 'developer-applications', application.id), {
            status: 'approved',
            reviewedBy: currentUser?.uid || null,
            reviewedAt: serverTimestamp()
          });
          await addDoc(collection(db, 'developers'), {
            uid: null,
            email: application.email,
            name: application.name,
            phone: application.phone,
            approvedAt: serverTimestamp(),
            status: 'approved'
          });
          setBanner(`Approved developer request for ${application.email}.`);
          loadApplications();
        } catch (error) {
          console.error('Approval failed:', error);
          setBanner('Developer approval failed.', true);
        }
      });

      card.querySelector('.reject-btn').addEventListener('click', async () => {
        try {
          await updateDoc(doc(db, 'developer-applications', application.id), {
            status: 'rejected',
            reviewedBy: currentUser?.uid || null,
            reviewedAt: serverTimestamp()
          });
          setBanner(`Rejected developer request for ${application.email}.`);
          loadApplications();
        } catch (error) {
          console.error('Reject failed:', error);
          setBanner('Developer rejection failed.', true);
        }
      });

      applicationsList.appendChild(card);
    });
  } catch (error) {
    console.error('Failed to load applications:', error);
    applicationsList.innerHTML = '<p class="small">Unable to load applications right now.</p>';
  }
}

async function checkAccess(user) {
  if (!user) {
    setBanner('Please log in to apply or manage developer access.');
    showElement(applicationShell, false);
    showElement(approvalShell, false);
    return;
  }

  currentUser = user;
  const profile = await getUserProfile(user);
  const isAdmin = await isAdminUser(user);
  const isDeveloper = profile?.role === 'developer';

  if (isAdmin) {
    setBanner('Admin access: review pending developer applications here.');
    showElement(applicationShell, false);
    showElement(approvalShell, true);
    await loadApplications();
    return;
  }

  showElement(applicationShell, true);
  showElement(approvalShell, false);
  setBanner(isDeveloper ? 'You are already a verified developer.' : 'Submit your developer application to request verification.');
  if (isDeveloper && applicationForm) {
    applicationForm.querySelectorAll('input, button').forEach((element) => element.disabled = true);
  }
}

onAuthStateChanged(auth, async (user) => {
  await checkAccess(user);
});

if (applicationForm) {
  applicationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentUser) {
      sessionStorage.setItem('redirectAfterLogin', window.location.href);
      window.location.href = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
      return;
    }

    const name = document.getElementById('application-name').value.trim();
    const email = document.getElementById('application-email').value.trim();
    const phone = document.getElementById('application-phone').value.trim();
    const reference = document.getElementById('application-reference').value.trim();

    if (!name || !email || !phone || !reference) {
      setBanner('Please fill in all application fields.', true);
      return;
    }

    try {
      await addDoc(collection(db, 'developer-applications'), {
        uid: currentUser.uid,
        email,
        name,
        phone,
        paymentReference: reference,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setBanner('Developer application submitted. Await admin approval.');
      applicationForm.reset();
    } catch (error) {
      console.error('Developer application failed:', error);
      setBanner('Unable to submit application at this time.', true);
    }
  });
}

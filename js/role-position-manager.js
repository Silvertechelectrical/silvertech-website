import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  limit
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const form = document.getElementById('role-position-form');
const statusEl = document.getElementById('role-position-status');
const listEl = document.getElementById('role-position-list');
const idInput = document.getElementById('role-position-id');
const nameInput = document.getElementById('role-position-name');
const roleInput = document.getElementById('role-position-role');
const descriptionInput = document.getElementById('role-position-description');
const permissionInputs = Array.from(document.querySelectorAll('#role-position-permissions input[type="checkbox"]'));
const resetBtn = document.getElementById('reset-role-position-btn');

function renderRoleOptions(roles = []) {
  const dataList = document.getElementById('role-name-options');
  if (!dataList) return;

  const predefinedRoles = ['user', 'developer', 'service_provider', 'sales_engineer', 'engineer', 'admin'];
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

let currentUser = null;

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#ff7b7b' : '#00D4FF';
}

function getSelectedPermissions() {
  return permissionInputs.filter((input) => input.checked).map((input) => input.value);
}

function resetForm() {
  if (form) form.reset();
  if (idInput) idInput.value = '';
  if (nameInput) nameInput.focus();
}

async function loadRolePositions() {
  if (!listEl) return;

  try {
    await loadRoleOptions();
    const snapshot = await getDocs(query(collection(db, 'role-positions'), orderBy('name', 'asc')));
    if (snapshot.empty) {
      listEl.innerHTML = '<p class="small">No roles or positions have been created yet.</p>';
      return;
    }

    listEl.innerHTML = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const perms = Array.isArray(data.permissions) ? data.permissions.join(', ') : 'None';
      return `
        <article class="service-card">
          <div class="catalog-card-actions">
            <button class="catalog-action edit-btn" data-edit-id="${docSnap.id}" type="button">✎</button>
            <button class="catalog-action delete-btn" data-delete-id="${docSnap.id}" type="button">✕</button>
          </div>
          <h3>${data.name || 'Untitled position'}</h3>
          <p class="meta">Role: ${data.role || '—'}</p>
          <p>${data.description || 'No description'}</p>
          <p class="meta">Permissions: ${perms}</p>
        </article>
      `;
    }).join('');

    listEl.querySelectorAll('[data-edit-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        const positionId = button.getAttribute('data-edit-id');
        const snap = await getDoc(doc(db, 'role-positions', positionId));
        if (snap.exists()) {
          const data = snap.data();
          if (idInput) idInput.value = snap.id;
          if (nameInput) nameInput.value = data.name || '';
          if (roleInput) roleInput.value = data.role || '';
          if (descriptionInput) descriptionInput.value = data.description || '';
          permissionInputs.forEach((input) => {
            input.checked = Array.isArray(data.permissions) && data.permissions.includes(input.value);
          });
        }
      });
    });

    listEl.querySelectorAll('[data-delete-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        const positionId = button.getAttribute('data-delete-id');
        const confirmed = confirm('Delete this position?');
        if (!confirmed) return;

        try {
          await deleteDoc(doc(db, 'role-positions', positionId));
          setStatus('Position deleted.');
          await loadRolePositions();
        } catch (error) {
          setStatus('Unable to delete position.', true);
        }
      });
    });
  } catch (error) {
    console.error('Failed to load role positions:', error);
    setStatus('Unable to load role positions.', true);
  }
}

async function saveRolePosition(event) {
  event.preventDefault();
  const name = nameInput?.value.trim();
  const role = roleInput?.value;

  if (!name || !role) {
    setStatus('Name and role are required.', true);
    return;
  }

  try {
    const payload = {
      name,
      role,
      description: descriptionInput?.value.trim() || '',
      permissions: getSelectedPermissions(),
      updatedAt: serverTimestamp(),
      createdBy: currentUser?.uid || null
    };

    if (idInput?.value) {
      await updateDoc(doc(db, 'role-positions', idInput.value), payload);
      setStatus('Position updated successfully.');
    } else {
      await addDoc(collection(db, 'role-positions'), {
        ...payload,
        createdAt: serverTimestamp()
      });
      setStatus('Position created successfully.');
    }

    resetForm();
    await loadRolePositions();
  } catch (error) {
    console.error('Failed to save role position:', error);
    setStatus('Unable to save role position.', true);
  }
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    setStatus('Please sign in as an admin to manage roles and positions.', true);
    return;
  }

  await loadRolePositions();
});

if (form) {
  form.addEventListener('submit', saveRolePosition);
}

if (resetBtn) {
  resetBtn.addEventListener('click', resetForm);
}

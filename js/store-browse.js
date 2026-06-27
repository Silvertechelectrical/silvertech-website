import { db } from './firebase-init.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const fallbackAssets = [
  {
    name: 'Mobile Sales App',
    description: 'A lightweight mobile ordering app for field sales teams.',
    category: 'Apps',
    uploadedBy: 'Silvertech',
    fileUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    featured: true,
    price: '4500'
  },
  {
    name: 'Field Checklists Pack',
    description: 'Downloadable checklist templates for site inspections.',
    category: 'Templates',
    uploadedBy: 'Silvertech',
    fileUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    featured: false,
    price: '1200'
  }
];

let allAssets = [];

function renderAssets(items) {
  const list = document.getElementById('store-items');
  if (!list) return;
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<p class="small">No uploaded assets available right now.</p>';
    return;
  }

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'service-card';
    card.innerHTML = `
      <img src="${item.fileUrl || '../assets/img/usablesilvertech.jpg'}" width="80" alt="${item.name}" onerror="this.onerror=null;this.src='../assets/img/usablesilvertech.jpg';">
      <div class="service-top">
        <h3>${item.name}</h3>
        ${item.featured ? '<span class="pill">Featured</span>' : ''}
      </div>
      <p class="meta">${item.category || 'App'}</p>
      <p>${item.description || 'Uploaded app or asset.'}</p>
      <p class="meta">Uploaded by: ${item.uploadedBy || 'Developer'}</p>
      <p><strong>${item.price ? item.price + ' KSH' : 'Free'}</strong></p>
      <button class="view-btn">View Details</button>
    `;

    card.querySelector('.view-btn').addEventListener('click', () => {
      window.open(item.fileUrl, '_blank');
    });

    list.appendChild(card);
  });
}

async function loadAssets() {
  const searchInput = document.getElementById('store-search');

  try {
    const q = query(collection(db, 'store-assets'), where('approved', '==', true));
    const snapshot = await getDocs(q);
    allAssets = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Failed to load assets:', error);
    allAssets = fallbackAssets;
  }

  renderAssets(allAssets);

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      const queryText = event.target.value.toLowerCase();
      const filtered = allAssets.filter((item) =>
        `${item.name} ${item.description} ${item.category} ${item.uploadedBy}`.toLowerCase().includes(queryText)
      );
      renderAssets(filtered);
    });
  }
}

loadAssets();

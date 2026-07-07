const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const serviceAccountPath = path.join(__dirname, 'serviceAccount.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Missing serviceAccount.json. Place your Firebase service account JSON file at the project root before running the seed script.');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedDatabase() {
  const collectionsToSeed = [
    {
      name: 'services',
      docs: [
        {
          name: 'Industrial Wiring',
          category: 'Electrical',
          price: 5000,
          description: 'Full industrial site wiring and maintenance.',
          featured: true,
          rating: 5,
          delivery: '2-3 business days',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          name: 'Telecom Network Audit',
          category: 'Telecom',
          price: 4500,
          description: 'Comprehensive network audit for telecom infrastructure.',
          featured: true,
          rating: 4.8,
          delivery: 'Same day',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          name: 'Backup Power Setup',
          category: 'Electrical',
          price: 7000,
          description: 'Reliable backup power installation for homes and businesses.',
          featured: false,
          rating: 4.6,
          delivery: 'Scheduled',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }
      ]
    },
    {
      name: 'users',
      docs: [
        {
          uid: 'demo-admin-001',
          email: 'admin@silvertech.com',
          displayName: 'Silvertech Admin',
          role: 'admin',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          uid: '9SphncWRLdRcHm8fjyT0M4JVfcv1',
          email: 'silvertech3l3ctrical@gmail.com',
          displayName: 'Silvertech Admin',
          role: 'admin',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          uid: 'demo-user-001',
          email: 'client@silvertech.com',
          displayName: 'Silvertech Client',
          role: 'user',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }
      ]
    },
    {
      name: 'developers',
      docs: [
        {
          uid: 'demo-developer-001',
          email: 'developer@silvertech.com',
          displayName: 'Silvertech Developer',
          role: 'developer',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }
      ]
    },
    {
      name: 'storeItems',
      docs: [
        {
          title: 'Electrical Installation Pack',
          category: 'Digital Asset',
          price: 1500,
          description: 'Premium installation templates and planning resources.',
          downloadUrl: 'https://example.com/assets/electrical-pack.pdf',
          featured: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          title: 'Telecom Setup Guide',
          category: 'Guide',
          price: 1200,
          description: 'Step-by-step setup guide for telecom installations.',
          downloadUrl: 'https://example.com/assets/telecom-guide.pdf',
          featured: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }
      ]
    },
    {
      name: 'requests',
      docs: [
        {
          userId: 'demo-user-001',
          serviceName: 'Industrial Wiring',
          status: 'pending',
          message: 'Please contact me about scheduling.',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }
      ]
    }
  ];

  for (const collection of collectionsToSeed) {
    for (const doc of collection.docs) {
      await db.collection(collection.name).add(doc);
    }
  }

  console.log('Database seeded successfully!');
}

seedDatabase().catch((error) => {
  console.error('Failed to seed database:', error);
  process.exit(1);
});

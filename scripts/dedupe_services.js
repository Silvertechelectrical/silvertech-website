const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Please set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function dedupeServices() {
  console.log('Fetching all services...');
  const snapshot = await db.collection('services').get();
  const all = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  console.log(`Loaded ${all.length} service docs.`);

  const groups = new Map();
  for (const service of all) {
    const key = `${(service.name || '').trim().toLowerCase()}|${(service.category || '').trim().toLowerCase()}|${service.price || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(service);
  }

  let marked = 0;
  for (const items of groups.values()) {
    if (items.length <= 1) continue;
    items.sort((a, b) => {
      const ta = a.createdAt && a.createdAt._seconds ? a.createdAt._seconds : 0;
      const tb = b.createdAt && b.createdAt._seconds ? b.createdAt._seconds : 0;
      return tb - ta;
    });
    const keep = items[0];
    for (const duplicate of items.slice(1)) {
      await db.collection('services').doc(duplicate.id).update({
        deleted: true,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        dedupedBy: 'dedupe_services.js',
        keptId: keep.id
      });
      marked += 1;
      console.log(`Marked duplicate ${duplicate.id} (keeping ${keep.id}).`);
    }
  }

  console.log(`Dedupe complete: marked ${marked} duplicate service docs as deleted.`);
}

dedupeServices().catch((err) => {
  console.error(err);
  process.exit(1);
});

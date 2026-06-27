const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const serviceAccountPath = path.join(__dirname, 'serviceAccount.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Missing serviceAccount.json. Place your Firebase service account JSON file at the project root before running this script.');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setDeveloper(uid, email, displayName) {
  if (!uid || uid === 'YOUR_USER_UID_HERE') {
    console.error('Replace YOUR_USER_UID_HERE with the Firebase UID of the account you want to make a developer.');
    process.exit(1);
  }

  const db = admin.firestore();
  await db.collection('developers').doc(uid).set({
    uid,
    email: email || '',
    displayName: displayName || '',
    role: 'developer',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  console.log(`Developer access granted for UID: ${uid}`);
}

const targetUid = process.argv[2] || 'YOUR_USER_UID_HERE';
const targetEmail = process.argv[3] || '';
const targetName = process.argv[4] || '';

setDeveloper(targetUid, targetEmail, targetName).catch((error) => {
  console.error('Failed to grant developer access:', error);
  process.exit(1);
});

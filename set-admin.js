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

async function setAdminClaim(uid) {
  if (!uid || uid === 'YOUR_USER_UID_HERE') {
    console.error('Replace YOUR_USER_UID_HERE with the Firebase UID of the account you want to make an admin.');
    process.exit(1);
  }

  await admin.auth().setCustomUserClaims(uid, { admin: true });
  console.log(`Admin claim set successfully for UID: ${uid}`);
}

const targetUid = process.argv[2] || 'YOUR_USER_UID_HERE';
setAdminClaim(targetUid).catch((error) => {
  console.error('Failed to set admin claim:', error);
  process.exit(1);
});

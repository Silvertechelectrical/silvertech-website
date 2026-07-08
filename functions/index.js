const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  auth: {
    user: 'apikey',
    pass: functions.config().sendgrid.api_key
  }
});

function sendEmail(subject, html, text) {
  return transporter.sendMail({
    from: functions.config().sendgrid.from_email,
    to: functions.config().sendgrid.to_email,
    subject,
    html,
    text
  });
}

exports.notifyNewRequest = functions.firestore
  .document('requests/{requestId}')
  .onCreate(async (snap) => {
    const requestData = snap.data();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="margin-top: 0; color: #0f172a;">New service request</h2>
        <p>A new service request has been submitted.</p>
        <ul>
          <li><strong>Service:</strong> ${requestData.serviceName}</li>
          <li><strong>Phone:</strong> ${requestData.customerPhoneNumber}</li>
          <li><strong>Status:</strong> ${requestData.status}</li>
          <li><strong>User ID:</strong> ${requestData.userId}</li>
        </ul>
        <p>Please follow up with the customer promptly.</p>
      </div>
    `;
    const text = `A new service request has been submitted.\n\nService: ${requestData.serviceName}\nPhone: ${requestData.customerPhoneNumber}\nStatus: ${requestData.status}\nUser ID: ${requestData.userId}\n\nPlease follow up with the customer promptly.`;

    await sendEmail(`New service request: ${requestData.serviceName}`, html, text);

    return null;
  });

exports.notifyDeveloperSignup = functions.firestore
  .document('developers/{developerId}')
  .onCreate(async (snap) => {
    const developerData = snap.data();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="margin-top: 0; color: #0f172a;">New developer signup</h2>
        <p>A new developer account was created.</p>
        <ul>
          <li><strong>Name:</strong> ${developerData.displayName || 'N/A'}</li>
          <li><strong>Email:</strong> ${developerData.email || 'N/A'}</li>
          <li><strong>UID:</strong> ${developerData.uid || 'N/A'}</li>
        </ul>
      </div>
    `;
    const text = `A new developer account was created.\n\nName: ${developerData.displayName || 'N/A'}\nEmail: ${developerData.email || 'N/A'}\nUID: ${developerData.uid || 'N/A'}`;

    await sendEmail('New developer signup', html, text);

    return null;
  });

exports.notifyStoreUpload = functions.firestore
  .document('store-assets/{assetId}')
  .onCreate(async (snap) => {
    const assetData = snap.data();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="margin-top: 0; color: #0f172a;">New store asset uploaded</h2>
        <p>A new asset was uploaded to the store.</p>
        <ul>
          <li><strong>Name:</strong> ${assetData.name || 'N/A'}</li>
          <li><strong>Uploaded by:</strong> ${assetData.uploadedBy || 'N/A'}</li>
          <li><strong>File:</strong> ${assetData.fileName || 'N/A'}</li>
          <li><strong>URL:</strong> <a href="${assetData.fileUrl || '#'}">${assetData.fileUrl || 'N/A'}</a></li>
        </ul>
      </div>
    `;
    const text = `A new asset was uploaded to the store.\n\nName: ${assetData.name || 'N/A'}\nUploaded by: ${assetData.uploadedBy || 'N/A'}\nFile: ${assetData.fileName || 'N/A'}\nURL: ${assetData.fileUrl || 'N/A'}`;

    await sendEmail('New store asset uploaded', html, text);

    return null;
  });

exports.notifyAdminApproval = functions.firestore
  .document('developers/{developerId}')
  .onUpdate(async (change) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    if (beforeData.approved === afterData.approved) {
      return null;
    }

    const approved = Boolean(afterData.approved);
    const subject = approved ? 'Developer approved' : 'Developer approval removed';
    const text = approved
      ? `Developer approval granted.\n\nName: ${afterData.displayName || 'N/A'}\nEmail: ${afterData.email || 'N/A'}\nUID: ${afterData.uid || 'N/A'}`
      : `Developer approval removed.\n\nName: ${afterData.displayName || 'N/A'}\nEmail: ${afterData.email || 'N/A'}\nUID: ${afterData.uid || 'N/A'}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="margin-top: 0; color: #0f172a;">${subject}</h2>
        <p>${text.replace(/\n/g, '<br>')}</p>
      </div>
    `;

    await sendEmail(subject, html, text);
    return null;
  });

// Callable function to list Firebase Auth users for admin UI
exports.listAuthUsers = functions.https.onCall(async (data, context) => {
  // Ensure caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const callerUid = context.auth.uid;

  // Allow if caller has admin custom claim
  if (context.auth.token && context.auth.token.admin) {
    // allowed
  } else {
    // Otherwise check Firestore users collection for managing_director role
    try {
      const userDoc = await admin.firestore().collection('users').doc(callerUid).get();
      if (!userDoc.exists || (userDoc.data() || {}).role !== 'managing_director') {
        throw new functions.https.HttpsError('permission-denied', 'Admin privileges required');
      }
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      throw new functions.https.HttpsError('internal', 'Failed to verify caller role');
    }
  }

  try {
    const maxResults = 1000;
    const list = [];
    const result = await admin.auth().listUsers(maxResults);
    result.users.forEach((u) => {
      list.push({ uid: u.uid, email: u.email || null, displayName: u.displayName || null });
    });
    return { users: list };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to list users');
  }
});

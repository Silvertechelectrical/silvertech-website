# Secure Development & Deployment Guide

## Overview
This guide explains how to use `.env` files for local development and GitHub Secrets for production deployment, ensuring your Firebase and Cloudinary credentials are never committed to version control.

## Local Development Setup

### 1. Create `.env` File
Create a `.env` file in the root directory with your credentials:

```env
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_auth_domain_here
FIREBASE_PROJECT_ID=your_project_id_here
FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
FIREBASE_APP_ID=your_app_id_here
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_UPLOAD_PRESET=your_upload_preset_here
```

### 2. Generate Local Config Files
Before running the app locally, generate `firebase-config.js` and `cloudinary-config.js`:

```bash
# On Windows (PowerShell)
$env_content = Get-Content .env | ConvertFrom-StringData
@"
window.FIREBASE_CONFIG = {
  apiKey: "$($env_content.FIREBASE_API_KEY)",
  authDomain: "$($env_content.FIREBASE_AUTH_DOMAIN)",
  projectId: "$($env_content.FIREBASE_PROJECT_ID)",
  storageBucket: "$($env_content.FIREBASE_STORAGE_BUCKET)",
  messagingSenderId: "$($env_content.FIREBASE_MESSAGING_SENDER_ID)",
  appId: "$($env_content.FIREBASE_APP_ID)"
};
"@ | Out-File -FilePath firebase-config.js -Encoding UTF8

@"
window.CLOUDINARY_CONFIG = {
  cloudName: "$($env_content.CLOUDINARY_CLOUD_NAME)",
  uploadPreset: "$($env_content.CLOUDINARY_UPLOAD_PRESET)"
};
"@ | Out-File -FilePath cloudinary-config.js -Encoding UTF8
```

Or on Linux/Mac (Bash):
```bash
cat > firebase-config.js <<EOF
window.FIREBASE_CONFIG = {
  apiKey: "$(grep FIREBASE_API_KEY .env | cut -d '=' -f2)",
  authDomain: "$(grep FIREBASE_AUTH_DOMAIN .env | cut -d '=' -f2)",
  projectId: "$(grep FIREBASE_PROJECT_ID .env | cut -d '=' -f2)",
  storageBucket: "$(grep FIREBASE_STORAGE_BUCKET .env | cut -d '=' -f2)",
  messagingSenderId: "$(grep FIREBASE_MESSAGING_SENDER_ID .env | cut -d '=' -f2)",
  appId: "$(grep FIREBASE_APP_ID .env | cut -d '=' -f2)"
};
EOF
```

### 3. Security Checklist
- ✅ `.env` file created with your credentials
- ✅ `.env` is listed in `.gitignore` (never committed)
- ✅ `firebase-config.js` is listed in `.gitignore`
- ✅ `cloudinary-config.js` is listed in `.gitignore`
- ✅ Only committed public files are in version control

## Production Deployment (GitHub Pages)

### 1. Set GitHub Secrets
Add these to your repository Settings → Secrets and variables → Actions:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_UPLOAD_PRESET`

### 2. GitHub Actions Workflow
The `.github/workflows/deploy.yml` automatically:
1. Generates `firebase-config.js` from secrets on every push to `main`
2. Generates `cloudinary-config.js` from secrets (optional)
3. Deploys to the `gh-pages` branch
4. Publishes to GitHub Pages

**Note:** `.github/workflows/deploy.yml` is the ONLY place these credentials appear - never in `.js` files in version control.

### 3. Enable GitHub Pages
1. Go to repository Settings → Pages
2. Set Source to `gh-pages` branch, `/` (root)
3. Custom domain (optional)

> The deployment workflow now also attempts to set the Pages source to `gh-pages` root automatically after publish.

After these steps, your app will be live at: `https://yourusername.github.io/your-repo/`

## File Structure Security

```
Root Directory:
├── .gitignore ← Prevents secrets from being committed
│   ├── .env
│   ├── firebase-config.js
│   ├── cloudinary-config.js
│   └── serviceAccount.json
├── .env.template ← Template for new developers (safe to commit)
├── .github/workflows/
│   └── deploy.yml ← Generates configs from GitHub Secrets
├── firebase-config.js ← Generated at runtime (local dev)
├── cloudinary-config.js ← Generated at runtime (local dev)
└── index.html ← Loads firebase-config.js BEFORE firebase-init.js
```

### Why This Setup?
- **Local Development:** `.env` + manual config generation allows safe local testing
- **Production:** GitHub Secrets + GitHub Actions automates safe deployment
- **Version Control:** Only safe files are committed; secrets never exposed
- **Onboarding:** `.env.template` shows new developers what to set up

## Public Shop Feature

### Overview
The shop feature allows customers to browse items without authentication, while developers can upload and manage items with authentication.

### Pages & Features

#### 1. Public Shop (pages/shop.html)
- **Access:** Anyone (no login required)
- **Features:**
  - Browse all published shop items
  - Search/filter items by name, category, description
  - View item details (name, category, price, format)
  - Submit purchase requests with email & phone
  - Publicly accessible via direct link
  - Same UI pattern as services page

#### 2. Shop Management (pages/shop-management.html)
- **Access:** Authenticated users in `developers` or `users.role='admin'` collection
- **Features:**
  - Upload new items with file attachment
  - Edit item names and details
  - Delete items
  - Items auto-saved to Firestore `shop` collection
  - Files uploaded to Cloudinary
  - Pending approval status until admin publishes

#### 3. Firestore Collections
```javascript
// shop collection - publicly browseable when published=true
{
  id: "auto-generated",
  name: "Network Audit Template",
  category: "Templates",
  description: "Ready-to-use site audit checklist...",
  price: "2500",
  downloadFormat: "PDF",
  featured: false,
  fileUrl: "https://res.cloudinary.com/...",
  uploadedBy: "uid...",
  uploadedByEmail: "user@email.com",
  published: false,  // Admin must approve
  createdAt: timestamp,
  rating: 4.5
}

// shop-purchases collection - purchase requests
{
  id: "auto-generated",
  itemName: "Network Audit Template",
  customerEmail: "buyer@email.com",
  customerPhone: "+254712345678",
  status: "pending",
  createdAt: timestamp
}
```

### Navigation Updates
- Main nav now includes: Services, Shop, Dashboard, Login
- Shop link opens public store
- Shop Management page link can be added to dashboard for admins/developers

### Comparison: Services vs Shop

| Feature | Services | Shop |
|---------|----------|------|
| **View without login** | ✅ Yes | ✅ Yes |
| **Request/Purchase without login** | ❌ Redirects to login | ✅ Requires email/phone |
| **Upload items** | N/A | 🔐 Authenticated only |
| **Admin approval** | Auto-posted | ✅ Requires admin |
| **Data stored in** | Firestore `services` | Firestore `shop` |
| **Use case** | Services offered | Items for sale |

## Troubleshooting

### "firebase-config.js not found" (404)
- Check that `firebase-config.js` exists in root directory
- Verify script load order: `<script src="firebase-config.js"></script>` BEFORE `<script type="module" src="js/firebase-init.js"></script>`
- Ensure `window.FIREBASE_CONFIG` is defined before `firebase-init.js` loads

### GitHub Pages shows 404
- Verify `.github/workflows/deploy.yml` runs on push to main
- Check that `gh-pages` branch exists with content
- Go to Settings → Pages and ensure source is set to `gh-pages` branch, root

### Shop items not appearing
- Verify Firestore `shop` collection exists
- Check that items have `published: true` status
- Ensure Firestore security rules allow public read access to published items

### Cloudinary uploads fail
- Verify `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET` are correct
- Check upload preset is set to "Unsigned" in Cloudinary settings
- Ensure file size is under Cloudinary limits

## Environment Checklist

- ✅ `.env` file created locally (not committed)
- ✅ `.env.template` committed (for team reference)
- ✅ `firebase-config.js` and `cloudinary-config.js` generated from `.env`
- ✅ GitHub Secrets set up with all 8 keys
- ✅ `.github/workflows/deploy.yml` configured to generate configs from secrets
- ✅ GitHub Pages source set to `gh-pages` branch
- ✅ Public shop page (pages/shop.html) deployed
- ✅ Shop management page (pages/shop-management.html) protected by auth
- ✅ Firestore collections created: `shop`, `shop-purchases`, `developers`, `users`

## Next Steps

1. **Copy `.env.template` to `.env`** and fill in your actual credentials
2. **Generate config files** using the scripts above
3. **Test locally** by opening `index.html` in your browser
4. **Push to GitHub** to trigger GitHub Actions workflow
5. **Verify GitHub Pages** is live at your deployment URL
6. **Create first shop item** at `/pages/shop-management.html` (after login)
7. **Publish items** through admin dashboard once uploaded
8. **Share shop link** publicly to customers - no login required to browse

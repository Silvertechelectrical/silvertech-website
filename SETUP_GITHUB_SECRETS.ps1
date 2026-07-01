# GitHub Secrets Setup Script
# This script helps you manually add secrets to your GitHub repository

$secrets = @{
    "FIREBASE_API_KEY" = "AIzaSyAyWmtNLpYNGVfKAz9LJsZ75K-s3of_JzA"
    "FIREBASE_AUTH_DOMAIN" = "silvertech-portal.firebaseapp.com"
    "FIREBASE_PROJECT_ID" = "silvertech-portal"
    "FIREBASE_STORAGE_BUCKET" = "silvertech-portal.firebasestorage.app"
    "FIREBASE_MESSAGING_SENDER_ID" = "934278665675"
    "FIREBASE_APP_ID" = "1:934278665675:web:4c0a75d658346a6e34124e"
    "CLOUDINARY_CLOUD_NAME" = "dkv7a8rcm"
    "CLOUDINARY_UPLOAD_PRESET" = "my_silvertechelectrical_preset"
}

Write-Host "=== GitHub Repository Secrets Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To add secrets to your GitHub repository, follow these steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to: https://github.com/Brianwgitau/silvertech-website/settings/secrets/actions" -ForegroundColor Green
Write-Host "2. Click 'New repository secret' button" -ForegroundColor Green
Write-Host "3. For each secret below, enter the Name and Value:" -ForegroundColor Green
Write-Host ""

$secrets.GetEnumerator() | ForEach-Object {
    Write-Host "Secret Name: $($_.Key)" -ForegroundColor Cyan
    Write-Host "Secret Value: $($_.Value)" -ForegroundColor White
    Write-Host "---" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "After adding all 8 secrets, your GitHub Actions workflow will generate" -ForegroundColor Green
Write-Host "the firebase-config.js and cloudinary-config.js files automatically." -ForegroundColor Green
Write-Host ""
Write-Host "Then push an empty commit to trigger the workflow:" -ForegroundColor Yellow
Write-Host "  git commit --allow-empty -m 'Trigger deploy with secrets configured'" -ForegroundColor DarkCyan
Write-Host "  git push origin main" -ForegroundColor DarkCyan

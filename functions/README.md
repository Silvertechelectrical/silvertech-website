# Firebase Functions

1. Install dependencies:
   cd functions
   npm install

2. Create a SendGrid account and obtain an API key.

3. Set the function config values:
   firebase functions:config:set sendgrid.api_key="SG.YourSendGridApiKey" sendgrid.from_email="you@yourdomain.com" sendgrid.to_email="admin@yourdomain.com"

4. Deploy:
   firebase deploy --only functions

The Cloud Function listens for new documents in the `requests` collection and sends an email notification through SendGrid.

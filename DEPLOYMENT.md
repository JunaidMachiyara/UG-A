# Usman Global Inventory & ERP System

React + TypeScript + Vite + Firebase inventory management application.

## 🚀 Deployment Setup

### Netlify Environment Variables

Add these to **Site configuration → Environment variables**:

```
VITE_FIREBASE_API_KEY=AIzaSyAHdAvXANJDg-CtlLM2DuHDWo1c38H1QZg
VITE_FIREBASE_AUTH_DOMAIN=ug-a-64252.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ug-a-64252
VITE_FIREBASE_STORAGE_BUCKET=ug-a-64252.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=66668419350
VITE_FIREBASE_APP_ID=1:66668419350:web:319b793e25046f64571837
VITE_FIREBASE_MEASUREMENT_ID=G-F6GXB091P9
```

**Note:** Firebase client-side API keys are safe to expose publicly. They are designed to be included in web apps and are protected by Firebase Security Rules.

### Build Settings

- **Build command:** `npm run build`
- **Publish directory:** `dist`

## 🛠️ Local Development

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Run `npm install`
4. Run `npm run dev`

## 📦 Features

- **Dashboard** - Overview of business metrics
- **Data Entry** - Sales, purchases, production recording
- **Reports Module** - Comprehensive reporting system
  - Original Stock Report
  - Item Performance Report
  - Order Fulfillment Dashboard
- **CSV Import/Export** - Bulk data operations
- **CSV Validator** - Pre-import validation
- **Admin Module** - Database management tools

## 🔒 Security Note

Firebase API keys in this project are **client-side keys** and are meant to be public. Security is enforced through Firestore Security Rules, not by hiding the API key. See [Firebase documentation](https://firebase.google.com/docs/projects/api-keys) for details.

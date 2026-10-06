# NIFES UNIBEN

Mobile-first NIFES UNIBEN registration, programme and attendance website built with Next.js, React, TypeScript, Auth.js, and Cloud Firestore.

## Features

- Public registration with validation, consent, duplicate protection, member IDs, and downloadable QR codes.
- Public self check-in, plus staff QR scanning, guest check-in, offline scan queue, and attendance history.
- Admin dashboard, member records, events and sessions, reports/CSV, first-timer follow-up, access control and audit history.
- Google sign-in with a server-side allowlist: the seeded Super Admin and email addresses invited by that admin.
- Light-blue responsive website with Explore navigation, horizontally scrolling programme cards, and inline registration with an animated confirmation.

## Run locally

Requirements: Node.js 22+, pnpm, and a Firebase project with Cloud Firestore enabled.

1. Copy `.env.example` to `.env.local` and set Firebase service-account credentials, `AUTH_SECRET`, Google OAuth values, and `NEXT_PUBLIC_APP_URL`.
2. Install packages with `pnpm install`.
3. Seed the initial programme and Super Admin with `pnpm run db:seed`.
4. Start the site with `pnpm dev` and open `http://localhost:3000`.

The landing page and its sample schedule still render before Firebase is configured, but registration and attendance writes need a working Firestore connection.

## Firebase setup and security

1. Create a Firebase project and a Cloud Firestore database in Native mode.
2. Create a server service account for the app and grant only the Firestore data role it needs. In local development, use Application Default Credentials by setting `FIREBASE_PROJECT_ID` and `FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS=true`, or set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. On Vercel, add the service-account values as encrypted environment variables. A single `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable is also supported.
3. Set the Firestore rules from `firestore.rules`. Browser clients are denied direct database access; only the Next.js server accesses Firestore through Firebase Admin. Admin SDK access bypasses Firestore rules, so keep the service-account key private and preserve the server-side role checks on every admin page and API.
4. Run `pnpm run db:seed` once to add the Super Admin and default weekly programme.

The app uses server-side Firestore document collections: `members`, `admin_users`, `recurring_events`, `sessions`, `attendance`, `follow_ups`, `audit_logs`, `rate_limits`, and `member_sequences`. Related record checks are made by the Next.js server.

## Sign-in and deployment

- Google OAuth is used only for staff sign-in. Add the deployed site origin and `https://YOUR_DOMAIN/api/auth/callback/google` as the OAuth web client's authorized origin and redirect URI.
- Configure `AUTH_SECRET`, `AUTH_URL`, Google OAuth credentials, `SUPER_ADMIN_EMAIL`, the Firebase project/service-account values, and optional email sender values in the hosting environment.
- Connect the repository to Vercel and deploy on the Node.js 22 runtime.
- Replace placeholder social/contact links and review the privacy notice before collecting live records.

## Data handling notes

- The offline usher queue stores member IDs in the browser's local storage until it syncs. Use a managed usher device and clear the queue after each event.
- CSV exports are included. PDF/XLSX export formats, optional geofencing, and QR-based self check-in at the venue are not included.
- Firebase Admin server SDK calls are privileged and bypass Firestore Security Rules. API authentication and role checks are therefore the enforcement boundary for staff access; do not expose the service account to browser code.

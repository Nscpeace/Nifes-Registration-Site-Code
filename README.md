# NIFES UNIBEN

Mobile-first registration, programme management and attendance application built with Next.js App Router, React, TypeScript, Auth.js and PostgreSQL/Prisma.

## Architecture

- `src/app`: public home, registration, self check-in and privacy pages; protected dashboard, members, events, sessions, usher scanner, follow-up, report, access and audit pages; API routes.
- `src/lib`: Prisma client, phone normalization, RBAC, database-backed rate limits, recurring session generation and open-session selection.
- `prisma/schema.prisma` and `prisma/migrations`: relational PostgreSQL schema and migration. `prisma/seed.ts` inserts the default programme and active Super Admin.
- `public/sw.js`: caches only public page shells. It bypasses `/api` and `/admin` so private member/attendance data are not stored in the web cache.

## Implemented workflows

- Public registration with server-side validation, required consent, normalized Nigerian phone numbers, duplicate email/phone prevention, sequenced member IDs, a personal QR code, optional Resend email, and friendly duplicate errors.
- Self check-in by phone or member ID during the selected session window; QR/usher check-in and duplicate attendance prevention; guest quick check-in; live usher attendance list and offline QR check-in queue.
- Weekly and last-Saturday recurrence generation on demand over an 8-day horizon. TBA events wait until an admin sets a time. Event and venue edits create updated future sessions; existing attendance remains tied to its original session.
- Google OAuth admin access restricted to seeded/invited emails with verified Google email. Server-side roles protect pages and API endpoints. Super Admin can invite, change role/status, or remove access while protecting the last active Super Admin.
- Member search and filters, edit/delete, attendance history; CSV member and attendance exports with date, gender, level and session filters; follow-up notes/status and WhatsApp/mail links; absentee report for consecutive Sunday Services; an attendance trend and source breakdown; Super Admin audit log.
- PostgreSQL-backed fixed-window rate limits for registration and check-in endpoints.

The offline usher queue stores member IDs in the browser’s local storage until sync. Use a managed usher device and clear the queue after the event. Keep HTTPS enabled.

## Setup

Requirements: Node.js 20+, pnpm, and PostgreSQL 14+.

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `AUTH_SECRET`, Google OAuth values and `NEXT_PUBLIC_APP_URL`.
2. Install dependencies with `pnpm install`.
3. Generate Prisma client and apply the checked-in migration: `pnpm run db:generate`, then `pnpm run db:migrate:deploy` (or `pnpm run db:migrate` for local development).
4. Seed the initial programme and Super Admin: `pnpm run db:seed`.
5. Start locally with `pnpm run dev`; open `http://localhost:3000`.

`SUPER_ADMIN_EMAIL` defaults to `nscpeace1@gmail.com`. Seeding upserts it as an ACTIVE `SUPER_ADMIN`. OAuth credentials are still required before the account can sign in.

## Google OAuth setup

1. In Google Cloud Console, select a project and configure the OAuth consent screen.
2. Create an OAuth Client ID of type **Web application**.
3. Add Authorized JavaScript origins `http://localhost:3000` and your production HTTPS origin.
4. Add redirect URIs `http://localhost:3000/api/auth/callback/google` and `https://YOUR_DOMAIN/api/auth/callback/google`.
5. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and a generated high-entropy `AUTH_SECRET`. The sign-in callback verifies the Google email and checks current authorization status from PostgreSQL.

## Email and hosting

Set `RESEND_API_KEY` and a verified `EMAIL_FROM` sender to deliver welcome mail with the QR PNG attached. Registration still works without email configuration; the QR appears on-screen for download. For Vercel, configure all required environment variables and PostgreSQL first, run `prisma migrate deploy`, seed the database, then deploy. Never commit `.env` or credentials.

## Logo, colours, programme and venue

- Upload the logo to `public/assets/logo.png` (served as `/assets/logo.png`). The current header shows a CSS placeholder with the white circle, blue wordmark and pink cross.
- Palette variables are at the start of `src/app/globals.css`.
- The home page reads active recurring events from PostgreSQL. `/admin/events` changes schedule, venue, TBA and check-in windows; `/admin/sessions` creates one-off sessions and opens/closes sessions.
- Event times use `Africa/Lagos` local time. Recurring sessions are generated automatically when check-in is attempted or the sessions admin page opens, and continue 8 days ahead.
- A Super Admin adds team emails at `/admin/access`. Invitees use verified Google accounts and are activated on first sign-in.

## Remaining product work

- PDF/XLSX export formats are not included; CSV exports open in Excel.
- The optional geofence and self check-in via venue QR are not included. Members can use phone/member ID, while ushers scan member QR codes.
- Full accessibility review, production deployment, managed database provisioning, OAuth setup, backups and email sender verification require the operator’s credentials and should be completed before collecting live records.
- Replace placeholder contact and social links with official NIFES UNIBEN accounts.

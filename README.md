# Sridhar Driving School

A lesson-scheduling and attendance app for a driving school, built with React, Vite and a small serverless API on Vercel.

**There is no public sign-up.** The school office (admin) creates each customer's login and marks attendance. Customers sign in to book, change and cancel their own lessons. Light and dark mode are available on every page.

**Live site:** https://dsp-alpha.vercel.app/

## Features

**Admin**
- Dashboard: customers, lessons today, upcoming lessons, attendance rate, lessons still to mark, upcoming lessons per branch
- Customers: search, add (the admin sets the first password), edit, reset password, remove
- Lessons: schedule, reschedule and cancel lessons for any customer. Taken times are greyed out
- Attendance: filter by date, place or customer, mark present / absent, export the list to CSV

**Trainers and packages**
- Three trainers (Trainer 1, Trainer 2 and Trainer 3, the lady trainer). Rename them in `TRAINERS` in `src/rules.js`
- The admin picks a package when creating a customer: **Standard** (20 lessons, Trainer 1 or 2) or **Ladies** (10 lessons, lady trainer only)
- Every lesson has a trainer, chosen by the admin or by the customer. A trainer can't have two lessons at the same time
- The package can be changed only while the customer has no lessons

**Customers**
- Sign in with email or mobile number and the password the school gave them
- Book, change and cancel their own lessons (taken times are greyed out; other customers' names are never shown)
- See upcoming and past lessons, attendance and progress (lessons attended out of 20)
- At most 5 upcoming lessons at a time, and no more lessons than the package has (missed lessons can be replaced)
- After the last lesson of the package (20, or 10 for Ladies) is marked present, the profile and its lessons are removed automatically (the admin is asked to confirm first)

**Data is shared.** Everything is stored on the server, so every phone and browser sees the same data. Open pages refresh themselves every 30 seconds.

## Rules enforced by the server

- Times are always India time (Asia/Kolkata), whatever the visitor's device is set to
- No lessons in the past, and no two lessons at the same branch, date and time
- A customer cannot have two lessons at the same time. Simultaneous requests cannot double-book a slot
- Email and mobile number must be unique. Mobile numbers are validated (10-digit Indian format)
- Lessons that have started or been marked cannot be changed or cancelled
- A customer can only see and change their own lessons; customer accounts, attendance and other people's lessons are admin-only

## Run it on your computer

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # unit and API tests
npm run lint
npm run build     # production build in dist/
```

Locally the API runs inside the Vite dev server with safe defaults, and saves data to `.data/db.json` (ignored by git).
Sign in as **admin / admin123**, then add a customer and schedule a lesson. Delete `.data/` to start fresh.

## Deploy on Vercel

The site works only after these three one-time steps. Until then the login page shows what is missing.

1. **Connect a database.** In the Vercel project open **Storage**, create an **Upstash for Redis** database (the free plan is enough) and connect it to this project. Vercel adds the connection variables automatically.
2. **Add two environment variables** under **Settings > Environment Variables** (see `.env.example`):
   - `ADMIN_PASSWORD`: your admin password, at least 8 characters
   - `SESSION_SECRET`: at least 24 random characters. Generate one with
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Optional: `ADMIN_USERNAME` (defaults to `admin`)
3. **Redeploy** (Deployments > the latest one > Redeploy).

Changing `ADMIN_PASSWORD` signs the admin out everywhere. Resetting a customer's password signs that customer out everywhere.

## Security

- Passwords are stored as salted scrypt hashes, never in plain text, and are checked on the server
- Sessions use a signed, `HttpOnly`, `SameSite=Lax` cookie (`Secure` on https): the admin is signed out when the browser is closed (and after 12 hours at most), customers stay signed in for 7 days
- Changes need an `x-dsp` header that other websites cannot add, which blocks cross-site request forgery
- Sign-in is limited to 10 attempts per 15 minutes per IP address
- In production the API refuses to start without the admin password, session secret and database

## Project structure

```
api/[...slug].js     Vercel function: every /api/* request
server/handler.js    routes, sessions, login, rate limit
server/service.js    customers and lessons (business logic, double-booking locks)
server/security.js   password hashing, signed tokens, cookies
server/config.js     environment variables and production checks
server/store/        Upstash Redis store, and a local file store for development
src/rules.js         shared rules: validation, slot conflicts, India time, stats, CSV
src/state/           app state: loads server data, keeps it fresh
src/components/      Login, CustomerPortal, admin/* pages
```

Routes: `/login`, `/customer`, `/admin`, `/admin/customers`, `/admin/add`, `/admin/lessons`, `/admin/attendance`.
`vercel.json` sends every non-API path to `index.html` so these URLs work when refreshed.

## Roadmap

- [ ] WhatsApp / SMS / email lesson reminders
- [ ] Instructor management and payments
- [ ] Tamil / English language toggle

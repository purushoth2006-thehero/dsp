<<<<<<< HEAD
# DriveEasy Driving School

A lesson-booking and attendance app for a driving school, built with React and Vite.

Customers sign up, book, reschedule and cancel lessons, and track their progress. The admin manages customers, marks attendance and exports it to CSV.

**Live demo:** https://dsp-alpha.vercel.app/

## Features

**Customers**
- Create an account (email or mobile number + password) and sign in
- Book a lesson by date, time and branch. Taken or past slots are greyed out in the time list
- Reschedule or cancel upcoming lessons
- Progress tracker (lessons attended out of 20) and Upcoming / Past lists

**Admin**
- Dashboard: customers, lessons today, upcoming lessons, attendance rate, lessons still to mark, upcoming lessons per branch
- Customers: search, add, edit, remove
- Attendance: filter by date, place or customer, mark present/absent, export the filtered list to CSV

**Rules enforced**
- No booking in the past (uses the local date and time, not UTC)
- A branch cannot be double-booked at the same date and time
- A customer cannot have two lessons at the same time
- Email and mobile number must be unique; mobile numbers are validated (10-digit Indian format)
- Lessons that have started or been marked cannot be changed or cancelled

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # unit tests for the booking and validation rules
npm run lint
npm run build     # production build in dist/
```

### Demo logins

Shown on the login page in development. For a deployed build, set `VITE_SHOW_DEMO=true` to show them.

| Role | Login | Password |
| --- | --- | --- |
| Admin | `admin` | `admin123` |
| Customer | `alice@example.com` | `pass123` |

## Project structure

```
src/
  rules.js            business rules: validation, slot conflicts, stats, CSV (unit tested)
  store.js            localStorage persistence and demo data
  state/              app state: customers, appointments, session
  ui/                 reusable pieces: modal, confirm dialog, toasts, form fields
  components/         pages: Login, Register, CustomerPortal, admin/*
```

Routes: `/login`, `/register`, `/customer`, `/admin`, `/admin/customers`, `/admin/add`, `/admin/attendance`.
`vercel.json` rewrites all paths to `index.html` so these URLs work when refreshed.

## Important limitation

All data is stored in the browser's `localStorage`, and sign-in is checked in the browser. That means:

- Data is **per browser**: a booking made on one phone is not visible to the admin on another device.
- Passwords are stored as plain text and the admin password is in the source code. **Do not use real customer data.**

The next step is a real backend (Firebase Auth + Firestore, or Supabase). `src/state/AppProvider.jsx` is the only place that reads and writes data, so that is the file to change.

## Roadmap

- [ ] Backend with real authentication (Firebase / Supabase)
- [ ] WhatsApp / SMS / email lesson reminders
- [ ] Instructor management and payments
- [ ] Tamil / English language toggle
=======
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
"# dsp" 
"# dsp" 
>>>>>>> 1348fe2c352b1b47665f26caaedeb784de5dacbd

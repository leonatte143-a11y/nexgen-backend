# NEXGEN API (Node.js + Express + MySQL + Sequelize)

Backend derived from the **React Native** app’s service contracts in `../mobile-app/src/services/`. The Expo app lives in `../mobile-app/`.

## Stack

- Node 18+
- Express 4
- MySQL 8+
- Sequelize 6
- JWT (separate signing secrets for `user`, `partner`, `admin`)

## Setup

1. Create MySQL database: `CREATE DATABASE nexgen;`
2. `cd backend`
3. `npm install`
4. Copy `.env.example` to `.env` and set `DB_USER`, `DB_PASS` (or `DB_PASSWORD`), and JWT secrets.
5. `npm run db:seed` — creates tables (alter), admin user, seed categories, partner, services, sample user & booking.
6. `npm run dev` — default `http://0.0.0.0:4000` (reachable on LAN if `HOST=0.0.0.0`)

Health: `GET /health`  
Base path: `/api/v1/...`

## Response shape

```json
{
  "success": true,
  "data": { },
  "message": "optional"
}
```

Errors: `success: false`, HTTP 4xx/5xx, `message` with details.

## Auth

| Role   | Header |
|--------|--------|
| User   | `Authorization: Bearer <user_jwt>` |
| Partner| `Authorization: Bearer <partner_jwt>` |
| Admin  | `Authorization: Bearer <admin_jwt>` |

### User OTP (DB-backed)

- `POST /api/v1/auth/otp/request` `{ "phone": "9876543210" }` — creates a row in `otp_verifications` (hashed OTP, 5‑minute expiry). Optional local-only: `OTP_DEBUG_RESPONSE=true` adds `debugOtp` to JSON (never in production).
- `POST /api/v1/auth/otp/verify` `{ "phone": "9876543210", "otp": "<digits>" }`  
  Returns `data: { ok, token, message, user? }` (length matches `OTP_DIGITS`, default 6).

### Partner

- `POST /api/v1/auth/partner/login` `{ "phone": "9876543210", "otp": "<digits>" }` — same OTP rules as user; partner must exist (use seed or `POST /api/v1/partners/onboarding`).

### Register / profile (user)

- `POST /api/v1/auth/register` — public, upsert by `phone` (aligns with `authService.registerProfile`).
- `GET /api/v1/users/me` | `PUT /api/v1/users/me` — require user JWT.

### Admin

- `POST /api/v1/auth/admin/login` `{ "email", "password" }` (seed in `.env` / `ADMIN_SEED_*`).

## Main route map (see `docs/API_MOCK_MAP.md` for full mock → HTTP mapping)

| Mobile mock | Method & path (API v1) |
|-------------|-------------------------|
| `authService` | `/auth/otp/*`, `/auth/partner/login`, `/auth/register`, `/auth/admin/login` |
| `userService` | `/users/me` |
| `catalogService` | `/catalog/buckets`, `/catalog/services`, `/catalog/buckets/:bucketId/services`, `/catalog/services/:id`, `/catalog/search?q=`, `/catalog/top-rated?limit=` |
| `bookingService` | `/bookings`, `/bookings/:id`, `POST /bookings`, `POST /bookings/:id/cancel`, `POST /bookings/:id/review` |
| `partnerService` | `/partners/...` (onboarding, profile, requests, earnings, pricing, job actions) |
| `notificationService` | `/notifications`, `POST /notifications/read-all` |

## Business rules (enforced in services/controllers)

- **10%** platform commission on `basePrice + visitingFee` for new bookings (see `src/services/money.js` — same structure as `bookingService.computeBill` in the app).
- **Partner** cancellation credit **₹50** (`cancel-fee` flow); heavy-work decline credit **₹45** (mock `partnerService`).
- User cancel fee **₹50** (mock `bookingService.cancelBooking`).

## Project layout

```
backend/src
  app.js
  index.js
  config/database.js
  models/
  routes/
  controllers/
  services/
  middlewares/
  utils/
  serializers/    # DTOs matching front-end types
  scripts/seed.js
```

## Production notes

- Replace in-memory OTP with SMS + short-lived codes (Redis).
- Harden CORS, rate limits, Helmet, HTTPS.
- Use proper migrations (Sequelize CLI) instead of `sync({ alter: true })` only in development.

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
4. Copy `.env.example` to `.env` and set `DB_USER`, `DB_PASS` (or `DB_PASSWORD`), and JWT secrets. The server **refuses to start** unless every role can resolve a signing key: set `JWT_USER_SECRET`, `JWT_PARTNER_SECRET`, and `JWT_ADMIN_SECRET`, **or** set `JWT_SECRET` alone as a shared fallback for all roles.
5. `npm run db:seed` — creates tables (alter), admin user, seed categories, partner, services, sample user & booking.
6. `npm run dev` — default `http://0.0.0.0:4000` (reachable on LAN if `HOST=0.0.0.0`)

## Railway MySQL setup

1. In Railway, add a MySQL service from the project dashboard.
2. Attach the MySQL service to this backend service so Railway injects runtime variables.
3. Railway may expose env vars as `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD`, or as the alternative names `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`.
4. The backend also accepts `DATABASE_URL` or `MYSQL_URL` when present.
5. Redeploy the backend after attaching the database and confirm `DATABASE_URL` or `MYSQLHOST` is available.

### Initial setup (first time)

After MySQL service is attached to Railway, run the migration and seed:

```bash
npm run db:migrate   # creates all tables
npm run db:seed      # creates admin user, categories, sample services, etc.
```

Or in one command:

```bash
npm run db:setup     # runs both migrate and seed
```

Check Railway logs to confirm:
```
[NEXGEN] ✓ Database migration complete
[NEXGEN] Database connected
```

### Verifying the setup

1. Wait for both `npm run db:setup` commands to complete.
2. Check tables in Railway MySQL console: all tables (users, bookings, services, etc.) should exist.
3. Run a test:
   ```bash
   curl https://your-railway-backend-url/health
   # Expected: { "success": true, "data": { "status": "ok" }, "message": "NEXGEN API" }
   ```
4. Redeploy backend service (if not automatic).
5. Mobile app can now call `https://your-railway-backend-url/api/v1/...`.

### Troubleshooting Railway migration failures

- **Symptom:** `connect ECONNREFUSED 127.0.0.1:3306`  
  **Fix:** Ensure MySQL service is attached and `MYSQLHOST` environment variable is set. Redeploy.

- **Symptom:** `Railway MySQL variables are missing`  
  **Fix:** In Railway project settings, check that the MySQL service is connected to the backend service. The MySQL plugin should auto-inject variables like `MYSQLHOST`, etc.

- **Symptom:** Tables created but seeding failed halfway  
  **Fix:** Re-run `npm run db:seed` to complete or fix any seed data issues.

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

## Admin API (web panel)

Login: `POST /api/v1/auth/admin/login` `{ "email", "password" }`  
All routes below require `Authorization: Bearer <admin_jwt>`.

| Area | Endpoints |
|------|-----------|
| Dashboard | `GET /admin/dashboard/stats`, `bookings-chart`, `recent-activity`, `search-analytics`, `heatmap` |
| KYC | `GET /admin/partners/kyc/pending`, `POST .../approve`, `.../reject` |
| Pricing | `GET/PUT /admin/services/:id`, `GET/PUT /admin/categories/:id` |
| Bookings | `GET /admin/bookings`, `GET /admin/bookings/live`, `PUT /admin/bookings/:id/assign` |
| Support | `GET/POST /admin/support/tickets`, freeze/refund actions |
| Payouts | `GET /admin/payouts/queue`, `POST /admin/payouts/generate`, history & commission report |
| Marketing | `GET/POST /admin/coupons` |
| Users | `GET /admin/users`, `PUT /admin/users/:id/block` |
| Geo | `GET /admin/geo/zones`, `POST /admin/geo/surge` |
| Settings | `GET/PUT /admin/settings` |

After pulling admin changes, run `npm run db:seed` once (uses `alter: false` + safe column adds).  
Admin web app: `../admin-web/README.md`.

## Production notes

- Replace in-memory OTP with SMS + short-lived codes (Redis).
- Harden CORS, rate limits, Helmet, HTTPS.
- Use proper migrations (Sequelize CLI) instead of `sync({ alter: true })` only in development.

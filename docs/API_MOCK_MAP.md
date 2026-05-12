# Mock service → HTTP API (v1)

React Native file → Backend endpoint (all under prefix `/api/v1`).

## `src/services/authService.ts`

| Method | API |
|--------|-----|
| `requestOtp(phone)` | `POST /auth/otp/request` body: `{ "phone" }` |
| `verifyOtp(phone, otp)` | `POST /auth/otp/verify` body: `{ "phone", "otp" }` → `data: { ok, token?, message? }` |
| `registerProfile(...)` | `POST /auth/register` body: fields matching `MockUser` + `phone` |
| `partnerLogin(phone, otp)` | `POST /auth/partner/login` body: `{ "phone", "otp" }` → `data: { ok, token? }` |
| `logout()` | `POST /auth/logout` (no server state; client drops token) |

## `src/services/userService.ts`

| Method | API |
|--------|-----|
| `getProfile()` | `GET /users/me` (Bearer user) |
| `updateProfile(partial)` | `PUT /users/me` (Bearer user) |

## `src/services/catalogService.ts`

| Method | API |
|--------|-----|
| `getBuckets()` | `GET /catalog/buckets` |
| `getCatalog()` | `GET /catalog/services` |
| `getServicesByBucket(bucketId)` | `GET /catalog/buckets/:bucketId/services` |
| `getServiceById(id)` | `GET /catalog/services/:id` |
| `searchServices(q)` | `GET /catalog/search?q=` |
| `getTopRated(limit)` | `GET /catalog/top-rated?limit=` |

## `src/services/bookingService.ts`

| Method | API |
|--------|-----|
| `getBookings()` | `GET /bookings` |
| `getBooking(id)` | `GET /bookings/:id` |
| `createBooking({...})` | `POST /bookings` body: `serviceId`, `address`, optional `notes`, `paymentMethod`, `promoCode`, `amountOverride`, `serviceNameOverride` |
| `cancelBooking(id)` | `POST /bookings/:id/cancel` |
| `submitReview(bookingId, stars, tags, note?)` | `POST /bookings/:id/review` body: `{ "stars", "tags", "note" }` |

## `src/services/partnerService.ts`

| Method | API |
|--------|-----|
| (register flow) `updateProfile` without login in mock | `POST /partners/onboarding` (public) body: KYC + `phone` |
| `getProfile()` | `GET /partners/profile` (Bearer partner) |
| `getRequests()` | `GET /partners/requests` |
| `getEarnings()` | `GET /partners/earnings` |
| `toggleOnline(online)` | `POST /partners/online` body: `{ "online": boolean }` |
| `acceptRequest(id)` | `POST /partners/requests/:id/accept` |
| `rejectRequest(id)` | `POST /partners/requests/:id/reject` |
| `startJob(id)` | `POST /partners/requests/:id/start` |
| `completeJob(id)` | `POST /partners/requests/:id/complete` |
| `submitEstimateUpdate(id, newAmount)` | `POST /partners/requests/:id/estimate` body: `{ "newAmount": number }` |
| `cancelActiveJobWithFee(id)` | `POST /partners/requests/:id/cancel-fee` |
| `requestHeavyWorkEstimate(id, payload)` | `POST /partners/requests/:id/heavy-estimate` body: `extraLabor`, `materialCost`, `description` |
| `declineHeavyWorkEstimate(id)` | `POST /partners/requests/:id/decline-heavy` |
| `withdrawBalance()` | `POST /partners/withdraw` |
| `updateProfile(partial)` | `PUT /partners/profile` |
| `getPricingRows()` | `GET /partners/pricing` |
| `updatePricingBase(id, baseCost)` | `PUT /partners/pricing/:id` body: `{ "baseCost" }` |
| `addPricingRow(...)` | `POST /partners/pricing` body: `serviceName`, `category`, `baseCost` |

## `src/services/notificationService.ts`

| Method | API |
|--------|-----|
| `list()` | `GET /notifications` |
| `markAllRead()` | `POST /notifications/read-all` |

## Favorites (`src/context/FavoritesContext.tsx`)

- Persists in **AsyncStorage** only; **no** mock API. Optional future: `GET/POST /users/me/favorites`.

## Admin (future web; minimal routes here)

- `POST /admin/categories` — create category
- `POST /admin/services` — create service
- `GET /admin/services` — list all
- `GET /admin/users` — list users

(All require `Authorization: Bearer` admin token.)

## Sample success payloads

`docs/SAMPLE_RESPONSES.md`

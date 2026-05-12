# Sample JSON responses

## `GET /api/v1/users/me`

```json
{
  "success": true,
  "data": {
    "id": "user_9876543210",
    "firstName": "Dwaraka",
    "lastName": "Sai",
    "email": "dwaraka.sai@email.com",
    "phone": "9876543210",
    "address": "Danavaipeta, Rajahmundry, AP",
    "rewardPoints": 850,
    "referralCode": "NEXGEN2026"
  },
  "message": ""
}
```

## `GET /api/v1/catalog/buckets` (excerpt)

```json
{
  "success": true,
  "data": [
    {
      "id": "home_repair",
      "nameEn": "Home Repair",
      "nameTe": "ఇంటి మరమ్మతు",
      "emoji": "🔧"
    }
  ],
  "message": ""
}
```

## `GET /api/v1/catalog/services` (one item, matches `CatalogService`)

```json
{
  "success": true,
  "data": [
    {
      "id": "svc_fan_repair",
      "bucketId": "home_repair",
      "name": "Fan Repair",
      "subtext": "Fan Repair",
      "categoryLabel": "Electrical",
      "basePrice": 250,
      "rating": 4.6,
      "reviewsCount": 187,
      "partner": {
        "id": "partner_phani",
        "name": "Phani Kumar",
        "rating": 4.8,
        "jobsCompleted": 245
      },
      "distanceKm": 1.2,
      "description": "Complete fan repairing and maintenance."
    }
  ],
  "message": ""
}
```

## `POST /api/v1/auth/otp/verify`

```json
{
  "success": true,
  "data": {
    "ok": true,
    "token": "<jwt>",
    "message": "Logged in."
  },
  "message": ""
}
```

## `GET /api/v1/partners/earnings` (aligns with `PartnerEarningsSummary`)

```json
{
  "success": true,
  "data": {
    "todayEarnings": 1250,
    "lifetimeEarnings": 67250,
    "availableBalance": 850,
    "totalJobs": 245,
    "completedJobs": 240,
    "commissionRate": 10,
    "pendingPayout": 0,
    "rewardPoints": 3200
  },
  "message": ""
}
```

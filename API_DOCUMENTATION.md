# RSL VIMS API Documentation

## Overview

The Road Safety Limited Vehicle Inspection Management System (RSL VIMS) provides a comprehensive REST API for integrating with external systems, mobile applications, and business intelligence tools.

**Base URL**: `https://your-domain.com/api/v1`

**Authentication**: API Key required for all endpoints

## Authentication

### API Key Authentication

All API requests require an API key passed in the `X-API-Key` header.

```bash
curl -H "X-API-Key: your-api-key-here" \
  https://your-domain.com/api/v1/vehicles
```

### Obtaining API Keys

Contact your system administrator to obtain an API key. API keys are scoped to specific permissions:
- `read`: Read-only access
- `write`: Create and update operational records
- `inspect`: Create inspection records
- `admin`: Administrative integration access

### Rate Limiting

API endpoints are rate-limited per API credential (or per IP when no credential is supplied). The default is **100 requests per minute** and can be configured with `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS`. In horizontally scaled/serverless production, configure Upstash Redis so limits are shared across instances.

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Requests remaining in the current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets

API keys are generated as one-time secrets and only a salted/HMAC hash is stored. Use `npm run api-key:create -- <user-email> <scopes> "<name>"` to issue a new integration credential.

## Response Format

All API responses follow a consistent format.

### Success Response

```json
{
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  },
  "meta": {
    "timestamp": "2026-01-XXT12:00:00Z",
    "requestId": "req_abc123"
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-01-XXT12:00:00Z",
    "requestId": "req_abc123"
  }
}
```

## Endpoints

### Health Check

#### GET /health

Check the health status of the API and its dependencies.

**Authentication**: Not required

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-XXT12:00:00Z",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 86400,
  "responseTime": "45ms",
  "services": {
    "database": {
      "status": "connected",
      "responseTime": "12ms"
    },
    "api": {
      "status": "operational"
    }
  },
  "metrics": {
    "totalUsers": 150,
    "totalVehicles": 500,
    "totalInspections": 1200
  }
}
```

---

### Vehicles

#### GET /vehicles

Retrieve a list of vehicles.

**Query Parameters**:
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 50, max: 100): Items per page
- `status` (string, optional): Filter by vehicle status
- `transporter_id` (string, optional): Filter by transporter ID

#### GET /vehicles/:id

Retrieve a specific vehicle by ID.

#### POST /vehicles

Create a new vehicle. The request is validated against the bounded vehicle creation schema. Successful creation emits the `vehicle.created` webhook event.

#### PATCH /vehicles/:id

Partially update an existing vehicle. Vehicle lifecycle transitions are validated and successful changes emit `vehicle.updated`.

#### DELETE /vehicles/:id

Decommission a vehicle while preserving referential and audit history. This operation emits `vehicle.updated` with status `decommissioned`.

---

### Transporters

#### GET /transporters

Retrieve a paginated list of active transporters. Optional `region` filtering is supported.

---

### Inspections

#### GET /inspections

Retrieve a paginated list of comprehensive inspections. Supported filters include `result` and `vehicle_id`.

#### GET /inspections/:id

Retrieve a specific inspection subject to API authentication and inspection permissions.

#### POST /inspections

Create a comprehensive inspection. Checklist outcome consistency, evidence limits, permissions and vehicle lifecycle rules are validated before persistence.

A successful non-failing inspection emits `inspection.completed`. An inspection with overall result `fail` emits `inspection.failed`.

---

### Locations

#### GET /locations

Retrieve inspection stations. Requires the `read` API scope and location permission.

---

### Power BI Integration

#### GET /powerbi

OData-style reporting endpoint for Power BI. Reporting fields are explicitly allow-listed and query parameters are bounded.

Supported query parameters include:
- `$filter`
- `$select`
- `$orderby`
- `$top`
- `$skip`
- `$count`

#### GET /powerbi/$metadata

Retrieve metadata matching the allow-listed Power BI reporting contract.

---

### Statistics

#### GET /stats

Retrieve system statistics. Requires the `read` API scope and reports permission.

---

### Predictive Maintenance

#### GET /predictive-maintenance

Retrieve predictive-maintenance analysis using bounded batched inspection history queries.

---

### AI Defect Detection

#### POST /ai/detect-defects

Submit supported inspection evidence for defect analysis. AI request bodies and evidence are bounded by the API safety policy.

---

### RFID Registry

#### GET /rfid?tag=RFID123456

Resolve an active RFID tag to its associated vehicle. Requires the `read` API scope and vehicle permission. A successful scan updates the tag's last-scanned timestamp.

#### POST /rfid

Assign or reassign an RFID tag to a vehicle. Requires the `write` API scope and vehicle permission.

**Request Body**:
```json
{
  "tag": "RFID123456",
  "vehicle_id": "vehicle-uuid"
}
```

A tag that is actively assigned to another vehicle returns HTTP `409` rather than silently overwriting the association.

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid input data |
| `NOT_FOUND` | Resource not found |
| `UNAUTHORIZED` | Invalid or missing API key |
| `FORBIDDEN` | Insufficient permissions |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |
| `DATABASE_ERROR` | Database connection failed |

## Webhooks

### Registration

`POST /webhooks` requires the `admin` API scope and user-management permission. Each API user can register at most 20 webhook destinations. A destination is validated as a public network target before persistence; production destinations must use HTTPS. Embedded credentials, local/internal names and private/reserved IP ranges are rejected.

The accepted event names are:

- `vehicle.created`
- `vehicle.updated`
- `inspection.completed`
- `inspection.failed`

If no signing secret is supplied, VIMS generates a strong secret and returns it once in the registration response. At rest the secret is encrypted using the configured field-encryption key.

### Delivery Coverage

The four events above are emitted from both the REST mutation routes and the corresponding web-administration Server Actions, so webhook behavior does not depend on which supported interface performed the operation.

Webhook failures are best-effort integration failures and do not roll back an already committed operational vehicle or inspection transaction. Delivery attempts update `lastTriggeredAt`; successful delivery resets `failureCount` and failed delivery increments it.

### Webhook Payload

```json
{
  "id": "delivery-uuid",
  "event": "inspection.completed",
  "timestamp": "2026-09-02T12:00:00.000Z",
  "data": {
    "id": "inspection-uuid",
    "inspectionNumber": "RSL-INS-20260902-ABC12345",
    "vehicleId": "vehicle-uuid",
    "vehicleRegistration": "GT-1234-22",
    "overallResult": "pass",
    "workflowStatus": "completed",
    "failedItemCount": 0,
    "criticalFailedItemCount": 0
  }
}
```

Event payloads intentionally contain only integration-relevant identifiers, status and outcome information; inspection evidence, signatures, identity secrets and full vehicle records are not included.

### Delivery Security

Before **every** delivery VIMS validates the stored URL again, resolves the destination hostname, rejects any non-public result, and opens the outbound connection to the already validated public IP while preserving the original hostname for the HTTP `Host` header and TLS SNI/certificate verification. This prevents ordinary DNS-rebinding between validation and connection. HTTP redirects are not followed automatically. Delivery has a five-second network timeout.

Each request includes:

- `X-Webhook-ID`: unique delivery-envelope identifier
- `X-Webhook-Event`: event name
- `X-Webhook-Timestamp`: ISO-8601 timestamp used in the signature
- `X-Webhook-Signature`: `sha256=<hex HMAC>`
- `Content-Type: application/json`

The HMAC-SHA256 input is the exact UTF-8 string:

```text
<X-Webhook-Timestamp>.<raw request body>
```

Verification example in Node.js:

```javascript
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyWebhook({ rawBody, timestamp, signature, secret }) {
  const expected = `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")}`;

  const receivedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length
    && timingSafeEqual(receivedBytes, expectedBytes);
}
```

Consumers should also reject timestamps outside their accepted replay window and deduplicate on `X-Webhook-ID` or the envelope `id`.

## Cryptographically Signed Certificate Verification

Version 2 certificates contain a QR code pointing to `/verify/<inspection-id>?sig=<signature>`. The signature is an HMAC over immutable certificate identity/result fields. If certificate data is altered after issuance, the old signed link will fail verification. Unsigned legacy links remain viewable but are explicitly marked as legacy/unsigned.

## Release Notes

### Enterprise V2.4 source-hardening candidate (2026-09-02)
- Hardened authentication, sessions, RBAC and transporter boundaries.
- Added bounded request/evidence/import handling and export formula neutralization.
- Added least-privilege Power BI reporting contracts and signed public certificate verification.
- Added production-quality Docker/liveness acceptance gates.
- Implemented signed, delivery-time SSRF-protected webhook dispatch for the documented vehicle and inspection events.

Production promotion remains a separate intentional operation; this source-only branch does not deploy or migrate production automatically.

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
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets

API keys are generated as one-time secrets and only a salted/HMAC hash is stored. Use `npm run api-key:create -- <user-email> <scopes> "<name>"` to issue a new integration credential.

## Response Format

All API responses follow a consistent format:

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
- `status` (string, optional): Filter by status (active, inactive, suspended)
- `search` (string, optional): Search by registration number, make, or model
- `transporterId` (string, optional): Filter by transporter ID

**Response**:
```json
{
  "data": [
    {
      "id": "veh_abc123",
      "registrationNumber": "GT-1234-22",
      "make": "Toyota",
      "model": "Hiace",
      "year": 2022,
      "status": "active",
      "transporter": {
        "id": "trp_xyz789",
        "name": "Metro Mass Transit"
      },
      "lastInspection": {
        "id": "ins_def456",
        "date": "2026-01-15",
        "result": "pass"
      },
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 500,
    "totalPages": 10
  }
}
```

#### GET /vehicles/:id

Retrieve a specific vehicle by ID.

**Response**:
```json
{
  "data": {
    "id": "veh_abc123",
    "registrationNumber": "GT-1234-22",
    "make": "Toyota",
    "model": "Hiace",
    "year": 2022,
    "vin": "1HGCM82633A123456",
    "chassisNumber": "CH123456",
    "engineNumber": "ENG789012",
    "status": "active",
    "transporter": {
      "id": "trp_xyz789",
      "name": "Metro Mass Transit"
    },
    "inspections": [
      {
        "id": "ins_def456",
        "date": "2026-01-15",
        "result": "pass",
        "inspector": "John Mensah"
      }
    ],
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-15T10:30:00Z"
  }
}
```

#### POST /vehicles

Create a new vehicle.

**Request Body**:
```json
{
  "registrationNumber": "GT-1234-22",
  "make": "Toyota",
  "model": "Hiace",
  "year": 2022,
  "vin": "1HGCM82633A123456",
  "chassisNumber": "CH123456",
  "engineNumber": "ENG789012",
  "transporterId": "trp_xyz789"
}
```

**Response**: `201 Created`
```json
{
  "data": {
    "id": "veh_abc123",
    "registrationNumber": "GT-1234-22",
    ...
  }
}
```

#### PUT /vehicles/:id

Update an existing vehicle.

**Request Body**: Same as POST (partial updates supported)

**Response**: `200 OK`

#### DELETE /vehicles/:id

Delete a vehicle (soft delete).

**Response**: `204 No Content`

---

### Transporters

#### GET /transporters

Retrieve a list of transporters.

**Query Parameters**:
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 50, max: 100): Items per page
- `search` (string, optional): Search by name or registration number
- `region` (string, optional): Filter by region

**Response**:
```json
{
  "data": [
    {
      "id": "trp_xyz789",
      "name": "Metro Mass Transit",
      "registrationNumber": "MMT-001",
      "region": "Greater Accra",
      "contactPerson": "Kwame Asante",
      "phone": "+233 20 123 4567",
      "email": "info@metromass.com",
      "vehicleCount": 50,
      "complianceRate": 95.5,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "totalPages": 1
  }
}
```

#### GET /transporters/:id

Retrieve a specific transporter by ID.

#### POST /transporters

Create a new transporter.

#### PUT /transporters/:id

Update an existing transporter.

#### DELETE /transporters/:id

Delete a transporter (soft delete).

---

### Inspections

#### GET /inspections

Retrieve a list of inspections.

**Query Parameters**:
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 50, max: 100): Items per page
- `result` (string, optional): Filter by result (pass, fail, conditional_pass)
- `vehicleId` (string, optional): Filter by vehicle ID
- `inspectorId` (string, optional): Filter by inspector ID
- `fromDate` (string, optional): Filter inspections from date (YYYY-MM-DD)
- `toDate` (string, optional): Filter inspections to date (YYYY-MM-DD)

**Response**:
```json
{
  "data": [
    {
      "id": "ins_def456",
      "inspectionNumber": "RSL-INS-2026-0001",
      "vehicle": {
        "id": "veh_abc123",
        "registrationNumber": "GT-1234-22"
      },
      "inspector": {
        "id": "usr_ins789",
        "name": "John Mensah"
      },
      "date": "2026-01-15T10:30:00Z",
      "result": "pass",
      "passRate": 98.5,
      "criticalDefects": 0,
      "majorDefects": 0,
      "minorDefects": 2,
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1200,
    "totalPages": 24
  }
}
```

#### GET /inspections/:id

Retrieve a specific inspection with full details.

**Response**:
```json
{
  "data": {
    "id": "ins_def456",
    "inspectionNumber": "RSL-INS-2026-0001",
    "vehicle": { ... },
    "inspector": { ... },
    "date": "2026-01-15T10:30:00Z",
    "result": "pass",
    "sections": [
      {
        "name": "Brakes",
        "items": [
          {
            "name": "Brake Pads",
            "status": "pass",
            "notes": ""
          }
        ]
      }
    ],
    "summary": {
      "totalItems": 150,
      "passed": 148,
      "failed": 0,
      "na": 2,
      "passRate": 98.5
    },
    "certificate": {
      "id": "cert_ghi012",
      "issuedAt": "2026-01-15T11:00:00Z",
      "validUntil": "2026-07-15T11:00:00Z",
      "qrCode": "https://your-domain.com/verify/cert_ghi012"
    }
  }
}
```

#### POST /inspections

Create a new inspection.

**Request Body**:
```json
{
  "vehicleId": "veh_abc123",
  "inspectorId": "usr_ins789",
  "sections": [
    {
      "name": "Brakes",
      "items": [
        {
          "name": "Brake Pads",
          "status": "pass",
          "notes": ""
        }
      ]
    }
  ]
}
```

**Response**: `201 Created`

---

### Daily Inspections

#### GET /daily-inspections

Retrieve a list of daily pre-trip inspections.

**Query Parameters**:
- `page`, `limit`, `vehicleId`, `driverId`, `date`, `status`

#### POST /daily-inspections

Create a new daily inspection.

---

### Users

#### GET /users

Retrieve a list of users (admin only).

#### GET /users/:id

Retrieve a specific user.

#### POST /users

Create a new user (admin only).

#### PUT /users/:id

Update a user.

#### DELETE /users/:id

Deactivate a user.

---

### Locations

#### GET /locations

Retrieve a list of inspection stations.

#### GET /locations/:id

Retrieve a specific location.

---

### Power BI Integration

#### GET /powerbi

OData v4 compliant endpoint for Power BI DirectQuery.

**Query Parameters**:
- `$filter`: OData filter expression
- `$select`: Fields to select
- `$orderby`: Sort order
- `$top`: Limit results
- `$skip`: Skip results

**Example**:
```
GET /api/v1/powerbi?$filter=OverallResult eq 'pass'&$top=100
```

#### GET /powerbi/$metadata

Retrieve OData metadata schema.

---

### Statistics

#### GET /stats

Retrieve system statistics.

**Response**:
```json
{
  "data": {
    "totalVehicles": 500,
    "activeVehicles": 450,
    "totalInspections": 1200,
    "passRate": 92.5,
    "topDefects": [
      {
        "name": "Worn Brake Pads",
        "count": 45
      }
    ],
    "inspectionsByMonth": [
      {
        "month": "2026-01",
        "count": 150
      }
    ]
  }
}
```

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

### Configuring Webhooks

Webhooks can be configured to receive real-time notifications for events:

- `vehicle.created`
- `vehicle.updated`
- `inspection.completed`
- `inspection.failed`
- `user.created`

### Webhook Payload

```json
{
  "event": "inspection.completed",
  "timestamp": "2026-01-XXT12:00:00Z",
  "data": {
    "id": "ins_def456",
    "vehicleId": "veh_abc123",
    "result": "pass"
  }
}
```

### Webhook Security

Webhooks are signed with HMAC-SHA256. Verify the signature using the `X-Webhook-Signature` header.

## SDKs and Libraries

### JavaScript/TypeScript

```javascript
const client = new RSLVIMSClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-domain.com/api/v1'
});

const vehicles = await client.vehicles.list({ page: 1, limit: 50 });
```

### Python

```python
from rsl_vims import Client

client = Client(api_key='your-api-key', base_url='https://your-domain.com/api/v1')
vehicles = client.vehicles.list(page=1, limit=50)
```

## Support

For API support, contact:
- Email: api-support@rsl.gh
- Documentation: https://docs.rsl.gh/api
- Status Page: https://status.rsl.gh

## Changelog

### v1.0.0 (2026-01-XX)
- Initial API release
- Vehicle, Transporter, Inspection endpoints
- Power BI integration
- RFID support
- Webhook support


## Cryptographically Signed Certificate Verification

Version 2 certificates contain a QR code pointing to `/verify/<inspection-id>?sig=<signature>`. The signature is an HMAC over immutable certificate identity/result fields. If certificate data is altered after issuance, the old signed link will fail verification. Unsigned legacy links remain viewable but are explicitly marked as legacy/unsigned.

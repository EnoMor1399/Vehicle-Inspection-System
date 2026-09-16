# Written Exam Evidence Storage

VIMS stores written examination file metadata in the existing `documents` registry and the file bytes in a **private Vercel Blob store**. Exam files are never persisted as base64 or binary payloads in PostgreSQL.

## Production setup

1. In the Vercel project for `vehicle-inspection-system`, connect or create a Blob store with **private** access.
2. Make sure Vercel provides `BLOB_READ_WRITE_TOKEN` to the environments where written exam uploads are required.
3. Redeploy the application after the storage environment variable is available.
4. Open **Driver Training → Assessments → Written Exams**. The page reports whether private storage is connected.

## Upload policy

- Authorized roles: users who satisfy the existing `canManageTraining` policy.
- Viewing/downloading: users who satisfy the existing `canViewTraining` policy.
- Allowed formats: PDF, JPEG, PNG and WebP.
- Maximum file size: 4 MB per file. This keeps the multipart request below the Vercel Function request-body ceiling. Multiple files can be attached to one assessment.
- Files are linked to the latest driver assessment and cannot be added after an active certificate has been issued.
- File signatures are checked for supported formats in addition to MIME type and extension checks.
- Private files are delivered through an authenticated VIMS endpoint with `no-store` and `nosniff` headers rather than exposing the Blob URL directly.
- Upload metadata is written to the VIMS audit log.

## Registry convention

Written exam evidence uses the existing `documents` table:

- `owner_type`: `training_assessment`
- `owner_id`: assessment ID
- `type`: `other`
- `name`: `Written Exam · <evidence type> · <safe original filename>`
- `url`: private Blob URL

This design avoids a production database migration and keeps exam documents attached to the controlled assessment record.

# Written Exam Evidence Architecture

Browser upload form → authenticated VIMS upload route → file/type/signature/size validation → latest-assessment and certificate-state checks → private Vercel Blob storage → existing VIMS `documents` registry → audit log.

In production, the Blob adapter authenticates with the project's connected `BLOB_STORE_ID` plus Vercel's short-lived OIDC identity (`VERCEL_OIDC_TOKEN` / request context). A long-lived `BLOB_READ_WRITE_TOKEN` remains an off-platform/local fallback only.

Authorized viewing follows the reverse path: Written Exam Evidence Register → authenticated VIMS file route → Driver Training access check → private Blob fetch → streamed response with `private, no-store` and `nosniff` protections.

The design deliberately stores only metadata and a private storage URL in PostgreSQL. File bytes remain outside the database.

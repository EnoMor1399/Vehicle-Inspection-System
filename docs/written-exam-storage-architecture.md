# Written Exam Evidence Architecture

Browser upload form → authenticated VIMS upload route → file/type/signature/size validation → latest-assessment and certificate-state checks → private Vercel Blob storage → existing VIMS `documents` registry → audit log.

Authorized viewing follows the reverse path: Written Exam Evidence Register → authenticated VIMS file route → Driver Training access check → private Blob fetch → streamed response with `private, no-store` and `nosniff` protections.

The design deliberately stores only metadata and a private storage URL in PostgreSQL. File bytes remain outside the database.

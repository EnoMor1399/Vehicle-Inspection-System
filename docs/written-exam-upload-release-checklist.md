# Written Exam Upload Release Checklist

- [ ] VIMS Quality Gate passes (typecheck, lint, tests, production build, Docker liveness smoke).
- [ ] A private Vercel Blob store is connected to the VIMS project.
- [ ] `BLOB_STORE_ID` is available to the intended Production deployment.
- [ ] Vercel OIDC is available at runtime (`VERCEL_OIDC_TOKEN` / request context). A long-lived `BLOB_READ_WRITE_TOKEN` is not required for production.
- [ ] Written Exams page reports **Private storage connected**.
- [ ] Authorized training manager can upload a PDF or supported image up to 4 MB.
- [ ] Uploaded evidence appears in the Written Exam Evidence Register.
- [ ] Authorized training user can View and Download the private document.
- [ ] Unauthorized/non-training user cannot upload or retrieve evidence.
- [ ] A document cannot be uploaded against an older assessment.
- [ ] A document cannot be uploaded after an active certificate has been issued.
- [ ] Audit log records the written exam evidence upload metadata.
- [ ] `BLOB_READ_WRITE_TOKEN` is used only when an off-platform/local workflow needs Blob access without Vercel OIDC.

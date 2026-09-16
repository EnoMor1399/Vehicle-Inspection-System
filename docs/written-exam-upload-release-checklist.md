# Written Exam Upload Release Checklist

- [ ] VIMS Quality Gate passes (typecheck, lint, tests, production build, Docker liveness smoke).
- [ ] A private Vercel Blob store is connected to the VIMS project.
- [ ] `BLOB_READ_WRITE_TOKEN` is available to the intended deployment environment.
- [ ] Written Exams page reports **Private storage connected**.
- [ ] Authorized training manager can upload a PDF or supported image up to 4 MB.
- [ ] Uploaded evidence appears in the Written Exam Evidence Register.
- [ ] Authorized training user can View and Download the private document.
- [ ] Unauthorized/non-training user cannot upload or retrieve evidence.
- [ ] A document cannot be uploaded against an older assessment.
- [ ] A document cannot be uploaded after an active certificate has been issued.
- [ ] Audit log records the written exam evidence upload metadata.

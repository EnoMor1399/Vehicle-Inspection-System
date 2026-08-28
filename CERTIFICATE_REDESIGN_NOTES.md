# Professional Certificate Redesign

This update redesigns the Vehicle Inspection Certificate to make it more formal, credible, and print-friendly.

## What changed

- upgraded the certificate to a more formal navy / gold / ivory visual language
- improved document hierarchy with a stronger institutional header
- added a refined reference card for certificate number and version
- added a formal title block and controlled-document subtitle panel
- introduced a professional summary band for inspection outcome and validity
- added executive information cards for certificate number, inspection date/time, and verification code
- improved spacing, typography, framing, and print fidelity
- retained QR verification and digital signature sections
- fixed certificate toolbar wiring so it correctly receives the inspection id
- fixed the relative import path for `CertificateToolbar`

## Files changed

- `src/app/certificate/[id]/page.tsx`
- `src/app/certificate/certificate.css`
- `src/app/certificate/CertificateToolbar.tsx`

## Suggested verification

Run locally after replacing the files:

```powershell
npm run typecheck
npm run lint
npm run build
```

Then open a certificate and test:

- on-screen preview
- print / save as PDF
- QR rendering
- verification link copying / sharing
- pass / fail / conditional / expired states

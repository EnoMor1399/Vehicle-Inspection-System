import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildWrittenExamDocumentName,
  isWrittenExamDocumentName,
  validateWrittenExamFileMetadata,
  writtenExamOriginalFilename,
  WRITTEN_EXAM_MAX_FILE_BYTES,
  WRITTEN_EXAM_OWNER_TYPE,
} from "../src/lib/written-exam-evidence";

test("written exam evidence metadata policy accepts only bounded passive document formats", () => {
  assert.equal(validateWrittenExamFileMetadata({ name: "theory.pdf", type: "application/pdf", size: 800_000 }), null);
  assert.equal(validateWrittenExamFileMetadata({ name: "road-signs.JPG", type: "image/jpeg", size: 900_000 }), null);
  assert.match(validateWrittenExamFileMetadata({ name: "exam.svg", type: "image/svg+xml", size: 4000 }) || "", /Only PDF/);
  assert.match(validateWrittenExamFileMetadata({ name: "paper.pdf", type: "text/html", size: 4000 }) || "", /Only PDF/);
  assert.match(validateWrittenExamFileMetadata({ name: "paper.png", type: "application/pdf", size: 4000 }) || "", /extension does not match/);
  assert.match(validateWrittenExamFileMetadata({ name: "large.pdf", type: "application/pdf", size: WRITTEN_EXAM_MAX_FILE_BYTES + 1 }) || "", /4 MB/);
});

test("written exam document names are bounded, recognizable and preserve a safe display filename", () => {
  const name = buildWrittenExamDocumentName("answer_script", "../Ama's Script (Final).pdf");
  assert.equal(WRITTEN_EXAM_OWNER_TYPE, "training_assessment");
  assert.equal(isWrittenExamDocumentName(name), true);
  assert.ok(name.length <= 255);
  assert.doesNotMatch(name, /\.\.\//);
  assert.match(name, /Written Exam · Answer script ·/);
  assert.match(writtenExamOriginalFilename(name), /Amas-Script-Final\.pdf/);
});

test("written exam upload endpoint enforces training authorization, record lineage and certificate lock", () => {
  const route = readFileSync("src/app/api/driver-training/written-exams/upload/route.ts", "utf8");
  assert.match(route, /canManageTraining/);
  assert.match(route, /isPrivateBlobStorageConfigured/);
  assert.match(route, /validateWrittenExamFileMetadata/);
  assert.match(route, /validateWrittenExamFileSignature/);
  assert.match(route, /latest assessment/);
  assert.match(route, /active certificate/);
  assert.match(route, /putPrivateBlob/);
  assert.match(route, /WRITTEN_EXAM_OWNER_TYPE/);
  assert.match(route, /training_written_exam_document/);
});

test("written exam private delivery endpoint requires training access and disables unsafe sniffing/cache", () => {
  const route = readFileSync("src/app/api/driver-training/written-exams/files/[documentId]/route.ts", "utf8");
  assert.match(route, /canViewTraining/);
  assert.match(route, /fetchPrivateBlob/);
  assert.match(route, /isWrittenExamDocumentName/);
  assert.match(route, /X-Content-Type-Options/);
  assert.match(route, /nosniff/);
  assert.match(route, /private, no-store/);
  assert.match(route, /Content-Disposition/);
});

test("written exam workspace exposes upload, evidence register, view and download controls", () => {
  const page = readFileSync("src/app/driver-training/assessments/written-exams/page.tsx", "utf8");
  const upload = readFileSync("src/app/driver-training/assessments/written-exams/WrittenExamEvidenceUpload.tsx", "utf8");
  assert.match(page, /Written Examination Scores & Evidence/);
  assert.match(page, /WrittenExamEvidenceUpload/);
  assert.match(page, /Written Exam Evidence Register/);
  assert.match(page, /\/api\/driver-training\/written-exams\/files\//);
  assert.match(page, /download=1/);
  assert.match(upload, /Upload written exam evidence/);
  assert.match(upload, /application\/pdf/);
  assert.match(upload, /Maximum: 4 MB per file/);
  assert.match(upload, /BLOB_READ_WRITE_TOKEN/);
});

test("proxy gives written exam upload the standard API origin, rate and body-size protections", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  const body = readFileSync("src/lib/request-body.ts", "utf8");
  assert.match(proxy, /WRITTEN_EXAM_API_PREFIX/);
  assert.match(proxy, /API_DOCUMENT_UPLOAD_BODY_LIMIT/);
  assert.match(proxy, /Origin not allowed/);
  assert.match(proxy, /rateLimit\("api"/);
  assert.match(body, /API_DOCUMENT_UPLOAD_BODY_LIMIT = 4_500_000/);
});

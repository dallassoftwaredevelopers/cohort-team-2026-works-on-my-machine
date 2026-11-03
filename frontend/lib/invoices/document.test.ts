import assert from "node:assert/strict";
import test from "node:test";
import { documentFormat } from "./document";

test("document formats come from content signatures", () => {
  const bytes = (text: string) => new TextEncoder().encode(text);
  assert.deepEqual(documentFormat(bytes("%PDF-1.7")), { mime: "application/pdf", extension: "pdf" });
  assert.equal(documentFormat(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))?.mime, "image/png");
  assert.equal(documentFormat(new Uint8Array([255, 216, 255, 224]))?.mime, "image/jpeg");
  assert.equal(documentFormat(bytes("GIF89a"))?.mime, "image/gif");
  assert.equal(documentFormat(bytes("RIFF1234WEBP"))?.mime, "image/webp");
});

test("unsupported, empty, or incomplete content is rejected", () => {
  for (const text of ["", "%PDF", "<svg></svg>", "<html>not a PDF</html>", "RIFF1234WAVE"]) {
    assert.equal(documentFormat(new TextEncoder().encode(text)), null);
  }
  assert.equal(documentFormat(new Uint8Array([137, 80, 78, 71])), null);
});

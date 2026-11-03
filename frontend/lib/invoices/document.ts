export const invoiceDocumentBucket = "invoice-pdfs";
export const maxDocumentBytes = 4 * 1024 * 1024;

// Detect supported formats from bytes rather than trusting an uploaded filename.
export function documentFormat(bytes: Uint8Array): { mime: string; extension: string } | null {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (text(0, 5) === "%PDF-") return { mime: "application/pdf", extension: "pdf" };
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])) return { mime: "image/png", extension: "png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: "image/jpeg", extension: "jpg" };
  if (["GIF87a", "GIF89a"].includes(text(0, 6))) return { mime: "image/gif", extension: "gif" };
  if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}

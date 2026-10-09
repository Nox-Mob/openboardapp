import { PDFDocument, type PDFPage } from "pdf-lib";

export interface Letterhead {
  bytes: ArrayBuffer | Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "application/pdf";
  headerPoints: number;
  footerPoints: number;
}

export const LETTERHEAD_MAX_BYTES = 10 * 1024 * 1024;

/** Parse actual file bytes rather than trusting the upload's extension or MIME label. */
export async function inspectLetterhead(bytes: Uint8Array): Promise<Letterhead["mimeType"]> {
  if (!bytes.length || bytes.length > LETTERHEAD_MAX_BYTES) throw new Error("Choose a nonempty file up to 10 MB.");
  const probe = await PDFDocument.create();
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    await probe.embedPng(bytes);
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    await probe.embedJpg(bytes);
    return "image/jpeg";
  }
  if (new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") {
    const pdf = await PDFDocument.load(bytes);
    if (pdf.getPageCount() !== 1) throw new Error("PDF letterhead must contain exactly one page.");
    const page = pdf.getPage(0);
    if (page.getWidth() > page.getHeight() || page.getRotation().angle !== 0) throw new Error("Use an unrotated, portrait PDF page.");
    return "application/pdf";
  }
  throw new Error("Choose a valid PNG, JPG or single-page, unprotected PDF.");
}

/** Embed once and paint on generated pages only; attached records are never rebranded. */
export async function prepareLetterhead(doc: PDFDocument, value?: Letterhead | null) {
  if (!value) return { top: 64, bottom: 84, draw: (_page: PDFPage) => {} };
  const top = Math.min(216, Math.max(72, value.headerPoints)) + 20;
  const bottom = Math.min(108, Math.max(36, value.footerPoints)) + 20;
  if (value.mimeType === "application/pdf") {
    const source = await PDFDocument.load(value.bytes);
    if (source.getPageCount() !== 1) throw new Error("PDF letterhead must contain exactly one page.");
    const embedded = await doc.embedPage(source.getPage(0));
    return { top, bottom, draw: (page: PDFPage) => page.drawPage(embedded, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() }) };
  }
  const image = value.mimeType === "image/png" ? await doc.embedPng(value.bytes) : await doc.embedJpg(value.bytes);
  return {
    top, bottom,
    draw: (page: PDFPage) => {
      const scale = Math.min((page.getWidth() - 128) / image.width, (top - 40) / image.height);
      const width = image.width * scale, height = image.height * scale;
      page.drawImage(image, { x: (page.getWidth() - width) / 2, y: page.getHeight() - 20 - height, width, height });
    },
  };
}
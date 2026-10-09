import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Builds text pages with simple word wrapping (WinAnsi-safe characters only).
function clean(s: string) {
  return s.replace(/[—–]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/·/g, "-").replace(/[^\x20-\x7E\n]/g, "");
}

async function addTextPages(doc: PDFDocument, title: string, body: string) {
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const width = 612, height = 792, margin = 64, size = 11, lh = 15;
  let page = doc.addPage([width, height]);
  let y = height - margin;
  page.drawText(clean(title), { x: margin, y, size: 16, font: bold, color: rgb(0.12, 0.25, 0.2) });
  y -= 30;
  const max = width - margin * 2;
  for (const para of clean(body).split("\n")) {
    const words = para.split(" ");
    let line = "";
    const flush = () => {
      if (y < margin) { page = doc.addPage([width, height]); y = height - margin; }
      page.drawText(line, { x: margin, y, size, font });
      y -= lh;
      line = "";
    };
    if (!para.trim()) { y -= lh / 2; continue; }
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) > max) { flush(); line = w; } else line = test;
    }
    if (line) flush();
  }
}

export async function textToPdf(title: string, body: string) {
  const doc = await PDFDocument.create();
  await addTextPages(doc, title, body);
  return doc.save();
}

export async function buildPacket(opts: { title: string; agendaText: string; attachments: { title: string; bytes: ArrayBuffer | null; fileName: string }[] }) {
  const doc = await PDFDocument.create();
  const contents = opts.attachments.map((a, i) => `${i + 1}. ${a.title} (${a.fileName})${a.bytes ? "" : " - not a PDF, available in the document library"}`).join("\n");
  await addTextPages(doc, opts.title, opts.agendaText + "\n\nSupporting documents\n" + (contents || "None"));
  for (const a of opts.attachments) {
    if (!a.bytes) continue;
    try {
      const src = await PDFDocument.load(a.bytes, { ignoreEncryption: true });
      const pages = await doc.copyPages(src, src.getPageIndices());
      pages.forEach((p) => doc.addPage(p));
    } catch {
      // unreadable PDF: listed in contents only
    }
  }
  return doc.save();
}

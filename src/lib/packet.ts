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

/** Standalone, formatted minutes document: letterhead, headings, motion blocks, approval and signature lines. */
export async function minutesToPdf(o: { orgName: string; meetingTitle: string; meetingDate: string; version: number; status: string; approvedAt?: string | null; approvedBy?: string | null; content: string }) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const green = rgb(0.12, 0.25, 0.2), grey = rgb(0.4, 0.4, 0.4);
  const W = 612, H = 792, M = 64, max = W - M * 2;
  const official = o.status === "approved";
  let page = doc.addPage([W, H]);
  let y = H - M;
  const footer = () => {
    page.drawText(clean(`${o.orgName} - Minutes v${o.version} - ${official ? "Official record" : o.status.toUpperCase() + " - not official"}`), { x: M, y: 32, size: 8, font: mono, color: grey });
    page.drawText(String(doc.getPageCount()), { x: W - M, y: 32, size: 8, font: mono, color: grey });
    if (!official) page.drawText(o.status.toUpperCase(), { x: 150, y: 380, size: 90, font: bold, color: rgb(0.85, 0.85, 0.85), opacity: 0.35 });
  };
  const newPage = () => { footer(); page = doc.addPage([W, H]); y = H - M; };
  const write = (text: string, f = font, size = 11, indent = 0, color = rgb(0, 0, 0)) => {
    const words = clean(text).split(" ");
    let line = "";
    const flush = () => { if (y < M + 20) newPage(); page.drawText(line, { x: M + indent, y, size, font: f, color }); y -= size + 4; line = ""; };
    for (const w of words) { const t = line ? line + " " + w : w; if (f.widthOfTextAtSize(t, size) > max - indent) { flush(); line = w; } else line = t; }
    if (line) flush();
  };
  // Letterhead
  page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: green });
  write(o.orgName.toUpperCase(), bold, 10, 0, green);
  y -= 4;
  write(`Minutes of ${o.meetingTitle}`, bold, 18, 0, green);
  write(o.meetingDate, font, 11, 0, grey);
  page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.75, color: green });
  y -= 12;
  const lines = o.content.split("\n");
  // Skip the plain-text header the generator adds (org name, title, date line) if present.
  let start = 0;
  if (lines[0]?.trim().toUpperCase() === o.orgName.toUpperCase()) start = lines[1]?.startsWith("Minutes of") ? (lines[2] !== undefined ? 3 : 2) : 1;
  for (const raw of lines.slice(start)) {
    const l = raw.trimEnd();
    if (!l.trim()) { y -= 6; continue; }
    if (/^\d+\.\s/.test(l) || l === "Other motions") { y -= 4; write(l, bold, 12, 0, green); }
    else if (l.startsWith("MOTION:")) {
      const top = y + 14;
      write(l, font, 10.5, 14);
      page.drawLine({ start: { x: M + 4, y: top }, end: { x: M + 4, y: y + 10 }, thickness: 2, color: green });
    } else if (/^(Present|Absent):/.test(l) || l.startsWith("A quorum")) write(l, font, 11);
    else write(l);
  }
  // Approval and signature
  y -= 24;
  if (y < M + 90) newPage();
  write(official ? `Approved as the official minutes${o.approvedAt ? ` on ${new Date(o.approvedAt).toLocaleDateString()}` : ""}${o.approvedBy ? ` by ${o.approvedBy}` : ""}.` : "Draft - these minutes have not been approved.", bold, 10.5);
  y -= 30;
  for (const label of ["Secretary", "Chair"]) {
    page.drawLine({ start: { x: M, y }, end: { x: M + 220, y }, thickness: 0.5, color: grey });
    page.drawText(label, { x: M, y: y - 12, size: 9, font, color: grey });
    page.drawLine({ start: { x: M + 260, y }, end: { x: M + 360, y }, thickness: 0.5, color: grey });
    page.drawText("Date", { x: M + 260, y: y - 12, size: 9, font, color: grey });
    y -= 44;
  }
  footer();
  return doc.save();
}

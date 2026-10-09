import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { inspectLetterhead, prepareLetterhead } from "./letterhead";
import { textToPdf, minutesToPdf } from "./packet";

async function stationery(pages = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([612, 792]);
  return doc.save();
}

describe("organization letterhead", () => {
  it("accepts a single-page PDF", async () => {
    expect(await inspectLetterhead(await stationery())).toBe("application/pdf");
  });
  it("rejects multi-page stationery", async () => {
    await expect(inspectLetterhead(await stationery(2))).rejects.toThrow("exactly one page");
  });
  it("rejects files pretending to be an image", async () => {
    await expect(inspectLetterhead(new TextEncoder().encode("not an image"))).rejects.toThrow("valid PNG, JPG");
  });
  it("accepts a valid PNG", async () => {
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7XcAAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
    expect(await inspectLetterhead(png)).toBe("image/png");
  });
  it("reserves header and footer space", async () => {
    const value = await prepareLetterhead(await PDFDocument.create(), { bytes: await stationery(), mimeType: "application/pdf", headerPoints: 120, footerPoints: 54 });
    expect(value.top).toBe(140);
    expect(value.bottom).toBe(74);
  });
  it("flows long branded documents onto multiple Letter pages", async () => {
    const letterhead = { bytes: await stationery(), mimeType: "application/pdf" as const, headerPoints: 120, footerPoints: 54 };
    const doc = await PDFDocument.load(await textToPdf("Agenda", Array(120).fill("A board agenda item.").join("\n"), letterhead));
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getPages().every((p) => p.getWidth() === 612 && p.getHeight() === 792)).toBe(true);
  });
  it("creates branded standalone minutes", async () => {
    const doc = await PDFDocument.load(await minutesToPdf({ orgName: "Test board", meetingTitle: "Monthly meeting", meetingDate: "2026-10-09", version: 1, status: "approved", content: "1. Call to order\nPresent: Test member", letterhead: { bytes: await stationery(), mimeType: "application/pdf", headerPoints: 120, footerPoints: 54 } }));
    expect(doc.getPageCount()).toBe(1);
  });
});
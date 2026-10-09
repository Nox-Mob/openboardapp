import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildPacket, textToPdf } from "./packet";
import { toCsv } from "./export";

describe("PDF generation", () => {
  it("minutes PDF is a valid document", async () => {
    const bytes = await textToPdf("Minutes — Board (v1)", "Line one\n\nLine two · with “quotes”");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
  it("long text flows onto more pages", async () => {
    const doc = await PDFDocument.load(
      await textToPdf("Long", Array(200).fill("A paragraph of minutes text.").join("\n")),
    );
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
  it("packet appends attached PDF pages after the agenda", async () => {
    const att = await PDFDocument.create();
    att.addPage();
    att.addPage();
    const attBytes = await att.save();
    const packet = await PDFDocument.load(
      await buildPacket({
        title: "Packet v1",
        agendaText: "Agenda\n1. Call to order",
        attachments: [
          {
            title: "Budget",
            fileName: "budget.pdf v1",
            bytes: attBytes.buffer.slice(0) as ArrayBuffer,
          },
          { title: "Photo", fileName: "photo.jpg v1", bytes: null },
        ],
      }),
    );
    expect(packet.getPageCount()).toBe(3);
  });
  it("an unreadable attachment does not break the packet", async () => {
    const packet = await PDFDocument.load(
      await buildPacket({
        title: "P",
        agendaText: "A",
        attachments: [
          {
            title: "Bad",
            fileName: "bad.pdf",
            bytes: new TextEncoder().encode("not a pdf").buffer as ArrayBuffer,
          },
        ],
      }),
    );
    expect(packet.getPageCount()).toBe(1);
  });
});

describe("CSV export", () => {
  it("writes a header from all columns and escapes values", () => {
    expect(
      toCsv([
        { a: 1, b: "x,y" },
        { a: "=1+1", c: null },
      ]),
    ).toBe('a,b,c\n1,"x,y",\n\'=1+1,,');
  });
  it("empty tables export as empty text", () => {
    expect(toCsv([])).toBe("");
  });
});

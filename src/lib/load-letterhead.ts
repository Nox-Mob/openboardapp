import { db } from "@/data";
import type { Letterhead } from "./letterhead";

export async function loadLetterhead(orgId: string): Promise<Letterhead | null> {
  const saved = await db.letterhead.get(orgId);
  if (!saved) return null;
  const bytes = await db.files.download(saved.storage_path);
  if (!bytes) throw new Error("Your letterhead could not be downloaded. Try again before generating the document.");
  return { bytes, mimeType: saved.mime_type as Letterhead["mimeType"], headerPoints: saved.header_points, footerPoints: saved.footer_points };
}
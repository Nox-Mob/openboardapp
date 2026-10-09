import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/data";
import { useCurrentOrg } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { inspectLetterhead } from "@/lib/letterhead";
import { loadLetterhead } from "@/lib/load-letterhead";
import { textToPdf } from "@/lib/packet";
import { downloadBlob, errorMessage } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LetterheadSettings() {
  const { org } = useCurrentOrg();
  const manager = can(org.role, "org.manage");
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [header, setHeader] = useState<number | null>(null);
  const [footer, setFooter] = useState<number | null>(null);
  const saved = useQuery({
    queryKey: ["letterhead", org.id],
    queryFn: () => db.letterhead.get(org.id),
  });
  const top = header ?? saved.data?.header_points ?? 120;
  const bottom = footer ?? saved.data?.footer_points ?? 54;

  async function upload(file: File) {
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = await inspectLetterhead(bytes);
      const extension = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
      await db.letterhead.save(
        {
          organization_id: org.id,
          storage_path: `${org.id}/letterhead/${crypto.randomUUID()}.${extension}`,
          file_name: file.name,
          mime_type: mime,
          header_points: top,
          footer_points: bottom,
        },
        new Blob([bytes], { type: mime }),
      );
      await qc.invalidateQueries({ queryKey: ["letterhead", org.id] });
      toast.success("Organization letterhead saved");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function saveSpacing() {
    if (!saved.data) return;
    setBusy(true);
    try {
      await db.letterhead.save({ ...saved.data, header_points: top, footer_points: bottom });
      await qc.invalidateQueries({ queryKey: ["letterhead", org.id] });
      toast.success("Letterhead spacing saved");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function sample() {
    setBusy(true);
    try {
      const letterhead = await loadLetterhead(org.id);
      const bytes = await textToPdf(
        "Letterhead proof",
        `${org.name}\n\nMeeting agenda\n1. Call to order\n2. Approval of previous minutes\n3. Reports and new business\n4. Adjournment\n\nCheck that this text clears your header and footer before generating meeting records.`,
        letterhead ? { ...letterhead, headerPoints: top, footerPoints: bottom } : null,
      );
      downloadBlob(
        new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
        "letterhead-proof.pdf",
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await db.letterhead.remove(org.id);
      await qc.invalidateQueries({ queryKey: ["letterhead", org.id] });
      setHeader(null);
      setFooter(null);
      toast.success("Default OpenBoard letterhead restored");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="col-span-full space-y-4 border-t pt-6">
      <div>
        <p className="eyebrow">Organization letterhead</p>
        <h2 className="mt-1 text-xl">Your stationery</h2>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {saved.isPending ? (
            <p className="text-sm text-muted-foreground">Loading letterhead…</p>
          ) : saved.isError ? (
            <p className="text-sm text-destructive">Letterhead could not be loaded.</p>
          ) : (
            <p className="break-all text-sm font-medium">
              {saved.data?.file_name ?? "OpenBoard default letterhead"}
            </p>
          )}
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf"
            aria-label="Upload organization letterhead"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            {manager && (
              <Button
                variant="outline"
                onClick={() => input.current?.click()}
                disabled={busy || saved.isPending || saved.isError}
              >
                <Upload className="size-4" />
                {saved.data ? "Replace letterhead" : "Upload letterhead"}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={sample}
              disabled={busy || saved.isPending || saved.isError}
            >
              <FileDown className="size-4" />
              Download proof
            </Button>
            {manager && saved.data && (
              <Button variant="ghost" onClick={remove} disabled={busy}>
                <Trash2 className="size-4" />
                Use default
              </Button>
            )}
          </div>
          {saved.data && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="letterhead-top">Header space (points)</Label>
                <Input
                  id="letterhead-top"
                  type="number"
                  min={72}
                  max={216}
                  value={top}
                  disabled={!manager || busy}
                  onChange={(e) => setHeader(Math.min(216, Math.max(72, Number(e.target.value))))}
                  className="mt-1 w-28"
                />
              </div>
              <div>
                <Label htmlFor="letterhead-bottom">Footer space (points)</Label>
                <Input
                  id="letterhead-bottom"
                  type="number"
                  min={36}
                  max={108}
                  value={bottom}
                  disabled={!manager || busy}
                  onChange={(e) => setFooter(Math.min(108, Math.max(36, Number(e.target.value))))}
                  className="mt-1 w-28"
                />
              </div>
              {manager && (
                <Button variant="outline" onClick={saveSpacing} disabled={busy}>
                  Save spacing
                </Button>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            New minutes and packet agenda pages use this letterhead on every page. Existing packet
            PDFs and attached documents stay unchanged. Minutes downloaded later use the current
            letterhead.
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <details open>
            <summary className="cursor-pointer font-medium">PNG / JPG preparation</summary>
            <p className="mt-2 text-muted-foreground">
              Upload a logo or wide header image, not a photograph of a full sheet. A transparent
              PNG gives the cleanest result; JPG is also supported. Aim for at least 1,500 pixels
              wide for a full-width header. It is centered and fitted without stretching. Maximum
              file size: 10 MB.
            </p>
          </details>
          <details open>
            <summary className="cursor-pointer font-medium">PDF preparation</summary>
            <p className="mt-2 text-muted-foreground">
              Upload one unprotected, unrotated portrait page of blank stationery, preferably US
              Letter (8.5 × 11 inches). A4 is accepted and scaled to Letter. Keep the middle blank:
              place branding within the top 120 points and footer within the bottom 54 points, or
              adjust the reserved spaces above. Keep side decorations outside the 64-point text
              margins. 72 points equals one inch. Maximum file size: 10 MB.
            </p>
          </details>
          <p className="text-sm text-muted-foreground">
            Download a proof to check spacing. Only organization owners and administrators can
            replace or remove letterhead.
          </p>
        </div>
      </div>
    </section>
  );
}

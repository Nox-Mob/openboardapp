/** Where a document's file version is stored: <org>/documents/<document>/v<version>-<safe name>. */
export function documentPath(
  orgId: string,
  documentId: string,
  version: number,
  fileName: string,
): string {
  const safe = fileName.replace(/[^\w.-]+/g, "_");
  return `${orgId}/documents/${documentId}/v${version}-${safe}`;
}

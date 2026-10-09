/**
 * The only way UI code reads or writes data.
 * `db` checks which platform is configured and hands back the matching adapter.
 */
import { cloudAdapter, type DataLayer } from "./cloud-adapter";
import { detectPlatform, type Platform, type PlatformEnv } from "./platform";

export { EXPORT_TABLES, type ExportTable, type DataLayer } from "./cloud-adapter";
export { detectPlatform, type Platform } from "./platform";

export function selectAdapter(platform: Platform): DataLayer {
  switch (platform) {
    case "lovable-cloud":
      return cloudAdapter;
    default:
      throw new Error("No data platform is configured for this app.");
  }
}

export const platform: Platform = detectPlatform(import.meta.env as unknown as PlatformEnv);
export const db: DataLayer = selectAdapter(platform);

/** Runs a data call and returns `{ data, error }` instead of throwing, for simple form handlers. */
export async function attempt<T>(p: Promise<T>): Promise<{ data: T; error: null } | { data: null; error: unknown }> {
  try {
    return { data: await p, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

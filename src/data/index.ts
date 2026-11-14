/**
 * The only way UI code reads or writes data.
 * `db` checks which platform is configured and hands back the matching adapter.
 */
import { cloudAdapter, type DataLayer } from "./cloud-adapter";
import { detectPlatform, type Platform, type PlatformEnv } from "./platform";

export { EXPORT_TABLES, type ExportTable, type DataLayer } from "./cloud-adapter";
export { detectPlatform, type Platform } from "./platform";
// Sign-in features only (two-step sign-in, security review round 2): the auth client, so screens
// can ask for a code without importing the database client themselves.
export { supabase as authClient } from "@/integrations/supabase/client";

export function selectAdapter(platform: Platform): DataLayer {
  switch (platform) {
    case "supabase":
      return cloudAdapter;
    default:
      throw new Error("No data platform is configured for this app.");
  }
}

export const platform: Platform = detectPlatform(import.meta.env as unknown as PlatformEnv);
export const db: DataLayer = selectAdapter(platform);

/** Runs a data call and returns `{ data, error }` instead of throwing, for simple form handlers. */
export async function attempt<T>(
  p: Promise<T>,
): Promise<{ data: T; error: null } | { data: null; error: NonNullable<unknown> }> {
  try {
    return { data: await p, error: null };
  } catch (error) {
    return { data: null, error: error ?? new Error("Something went wrong") };
  }
}

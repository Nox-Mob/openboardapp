/**
 * Decides which storage platform the data layer talks to.
 * Pages never import a database client; they call `db` from "@/data",
 * which picks an adapter based on this check.
 */
export type Platform = "lovable-cloud" | "unconfigured";

export interface PlatformEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export function detectPlatform(env: PlatformEnv): Platform {
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY) return "lovable-cloud";
  return "unconfigured";
}

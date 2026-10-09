import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Live-database tests sign in as dedicated test accounts that only belong to
// "Test Org A" / "Test Org B" — never to the demo or a real organization.
export const ORG_A = "a0000000-0000-0000-0000-00000000000a";
export const ORG_B = "b0000000-0000-0000-0000-00000000000b";
export const DEMO_ORG = "d0000000-0000-0000-0000-000000000001";

export const ACCOUNTS = {
  ownerA: { email: "test-a@demo.org", password: "test-a-1234" },
  memberA: { email: "test-member@demo.org", password: "test-member-1234" },
  ownerB: { email: "test-b@demo.org", password: "test-b-1234" },
} as const;

const env = (k: string) =>
  (import.meta.env as Record<string, string | undefined>)[k] ?? process.env[k];
export const DB_URL = env("VITE_SUPABASE_URL");
const KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY");
export const hasDb = Boolean(DB_URL && KEY) && process.env["SKIP_DB_TESTS"] !== "1";

export type Client = SupabaseClient<Database> & { userId: string };

export async function signIn(who: keyof typeof ACCOUNTS): Promise<Client> {
  const c = createClient<Database>(DB_URL!, KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.auth.signInWithPassword(ACCOUNTS[who]);
  if (error || !data.user) throw new Error(`Sign-in failed for ${who}: ${error?.message}`);
  return Object.assign(c, { userId: data.user.id });
}

export const tag = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

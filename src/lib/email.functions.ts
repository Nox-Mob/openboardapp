// Server functions for Board's email settings page (S-16).
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailSettingsInput } from "@shared/email/selfhost";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const client = (c: { supabase: unknown }) => c.supabase as SupabaseClient;

export const loadEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getEmailSettings } = await import("@shared/email/selfhost");
    const { selfHostContext } = await import("./email.server");
    return getEmailSettings(selfHostContext(client(context)));
  });

export const saveEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as EmailSettingsInput)
  .handler(async ({ data, context }) => {
    const { saveEmailSettings: save } = await import("@shared/email/selfhost");
    const { selfHostContext } = await import("./email.server");
    await save(selfHostContext(client(context)), data);
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendTestEmail: send } = await import("@shared/email/selfhost");
    const { selfHostContext, appOrigin, EMAIL_SETTINGS_PATH } = await import("./email.server");
    const ctx = selfHostContext(client(context));
    return send(ctx, {
      app: "board",
      appUrl: appOrigin(ctx.env, getRequest()),
      preferencesPath: EMAIL_SETTINGS_PATH,
    });
  });

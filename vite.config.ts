// Plain Vite config (suite step S-07): replaces Lovable's @lovable.dev/vite-tanstack-config
// wrapper with the same plugins, listed explicitly, as in OpenCharterApp. Order matters: Tailwind
// and tsconfig paths first, then TanStack Start, nitro (build only, Cloudflare Worker module),
// then React. Vite exposes VITE_* variables itself (from .env files and the environment).
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  server: { host: "::", port: 8080 },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Server-only modules can't be imported into the browser bundle.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // TanStack Start's server entry is src/server.ts (SSR error page and security headers).
      server: { entry: "server" },
    }),
    ...(command === "build" ? [nitro({ preset: "cloudflare-module" })] : []),
    viteReact(),
  ],
}));

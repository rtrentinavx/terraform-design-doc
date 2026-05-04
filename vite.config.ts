import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: "o4511332226891776",
      project: "javascript-react",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { assets: "./dist/**" },
      release: { auto: true },
    }),
  ],
  // Disable identifier renaming — prevents esbuild from renaming variables to
  // single letters which causes "Cannot access X before initialization" TDZ
  // crashes when the renamed name collides with a parameter in the same scope.
  // Whitespace and syntax minification are still applied.
  esbuild: {
    minifyIdentifiers: false,
    minifySyntax: true,
    minifyWhitespace: true,
  },
  server: {
    headers: {
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.anthropic.com https://*.sentry.io https://o4511332226891776.ingest.us.sentry.io https://generativelanguage.googleapis.com https://*.openai.azure.com; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
    proxy: {
      "/api/analyze": {
        target: "https://api.anthropic.com",
        changeOrigin: true,
        rewrite: () => "/v1/messages",
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.removeHeader("origin");
            proxyReq.removeHeader("referer");
          });
        },
      },
      "/api/openai-proxy": { target: "http://localhost:5173", changeOrigin: false },
    },
  },
});

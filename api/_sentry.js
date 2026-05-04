import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry() {
  if (initialized) return;
  Sentry.init({
    dsn: "https://4f41f9f03808c389e13b2ed36bc9d065@o4511332226891776.ingest.us.sentry.io/4511332244193280",
    tracesSampleRate: 0.2,
    environment: process.env.VERCEL_ENV || "development",
  });
  initialized = true;
}

export { Sentry };

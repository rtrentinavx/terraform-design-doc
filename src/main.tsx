import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { inject } from "@vercel/analytics";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

inject();

Sentry.init({
  dsn: "https://4f41f9f03808c389e13b2ed36bc9d065@o4511332226891776.ingest.us.sentry.io/4511332244193280",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: false }),
    Sentry.feedbackIntegration({ colorScheme: "system" }),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: false,
  environment: import.meta.env.MODE,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div style={{padding:40,fontFamily:"monospace",color:"#ff4444",background:"#111",minHeight:"100vh"}}>
          <h1>Something went wrong</h1>
          <pre style={{whiteSpace:"pre-wrap",marginTop:20}}>{(error as Error)?.message}</pre>
          <button onClick={resetError} style={{marginTop:20,padding:"8px 16px",cursor:"pointer"}}>Try again</button>
        </div>
      )}
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
);

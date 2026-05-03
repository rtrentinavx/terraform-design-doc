# Terraform Design Document Generator

Generate formal **Infrastructure Design Documents** from Terraform/OpenTofu configuration files using AI.

Upload your `.tf`, `.tfvars`, or `.zip` files and choose from three actions:

- **Generate IDD** — structured design document with network design, security, firewall, DCF, edge devices, components, and data flows
- **Explain Code** — plain-English explanation: summary, resources, architecture, security, variables, potential issues
- **Validate Code** — scored code review (0–100) with findings by severity and category

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173, configure a model profile, and upload Terraform files.

## Features

| Feature | Description |
|---|---|
| **Multi-Provider Model Profiles** | Named profiles for Anthropic, AWS Bedrock, Azure OpenAI, Google Gemini, or any OpenAI-compatible endpoint. Fetch live models, switch profiles in one click |
| **Mermaid Diagram** | Auto-rendered LR network topology with transit/spoke/firenet/DCF/edge nodes; re-renders on dark/light toggle |
| **Dynamic Registry Defaults** | Fetches live module defaults from registry.terraform.io for every module detected in uploaded files; 1h cache |
| **PII Redaction** | Public IPs, customer names, BGP ASNs, domains, emails scrubbed client-side before API call; rehydrated after |
| **Variable Resolution** | Resolves `var.X` references from `.tfvars` client-side so the model sees actual values |
| **Prompt Injection Protection** | TF content and Additional Instructions sanitized against injection patterns |
| **Anti-Hallucination** | Strict prompt rules — no invented spoke attachments, VPN connections, or data flows |
| **AI Transparency** | Disclaimer banner + caveats in IDD and DOCX; unknown vendor stays unknown |
| **Firewall Detection** | Palo Alto, Fortinet, Check Point — HA mode, instance size, license from tfvars |
| **DCF / Edge / Segmentation** | Full extraction of DCF policies, smart groups, edge devices, external connections |
| **DOCX Export** | Word document with AI disclaimer, caveats, and all IDD sections |
| **ZIP Support** | Auto-extracts `.tf`/`.tfvars` from uploaded ZIP archives |
| **promptfoo Tests** | Regression test suite: `npm run test:prompts` |

## Security

- **API keys** — stored in browser `localStorage` per profile; never on the server
- **PII redaction** — all sensitive data scrubbed client-side before any API call
- **Origin allowlist** — API endpoints return 403 for requests outside `*.vercel.app` / localhost
- **Body size limit** — 5 MB cap on all API endpoints
- **Prompt injection** — TF files and user instructions sanitized before sending
- **Security headers** — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

## Deploy to Vercel

1. Push this repo to GitHub
2. Import into [Vercel](https://vercel.com/new)
3. Deploy — no environment variables required (users supply their own API keys)

## Project Structure

```
terraform-design-doc/
  api/
    generate.ts         # Unified AI generation (Anthropic text / others structured)
    explain.ts          # Plain-English code explanation
    validate.ts         # Code validation with scored findings
    list-models.ts      # Live model listing per provider
    registry-defaults.js # Live Terraform Registry module defaults
    _origin.js          # Shared origin allowlist
  lib/
    iddSchema.ts        # Zod schema for the IDD output
    systemPrompt.ts     # System prompt shared by API and tests
  src/
    App.tsx             # Entire application (~1300 lines)
    iddTool.ts          # JSON Schema version of IDD (reference)
    main.tsx            # React entry point
  public/
    logo.svg            # App logo
    favicon.svg         # Browser tab icon
  test/
    fixtures/           # Terraform fixtures for promptfoo tests
  promptfoo.yaml        # Prompt regression test configuration
  vite.config.ts        # Dev server + esbuild config (minifyIdentifiers: false)
  vercel.json           # Security headers + rewrites
```

## Tech Stack

- **React 19** + **TypeScript** — UI
- **Vite** — Build tool (esbuild, identifier minification disabled to prevent TDZ crashes)
- **Tailwind CSS 3** — Styling
- **Vercel AI SDK** (`ai`, `@ai-sdk/*`) — Unified LLM client across all providers
- **Zod** — Schema validation for structured outputs
- **Mermaid.js** (CDN) — Network topology diagram rendering
- **docx** (CDN) — Word document generation
- **JSZip** (CDN) — ZIP file extraction
- **promptfoo** — Prompt regression testing

## How It Works

1. User uploads Terraform files (`.tf`, `.tfvars`, or `.zip`)
2. Client detects module sources and fetches live defaults from Terraform Registry
3. `.tfvars` values are resolved into `var.X` references inline
4. Sensitive data is redacted (IPs, names, ASNs, domains, emails)
5. Prompt injection patterns are stripped from file content and user instructions
6. Request sent to `/api/generate` (or `/api/explain` / `/api/validate`)
7. Server uses Vercel AI SDK: `generateText` for Anthropic/Bedrock, `generateObject` for others
8. Response validated with Zod, rehydrated with real PII values, rendered in DocView
9. User can export to DOCX or switch to Mermaid diagram view

## Running Prompt Tests

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run test:prompts       # Run regression tests against Claude
npm run test:prompts:view  # Open promptfoo web UI
```

## Local Development

```bash
npm run dev       # Start dev server (localhost:5173)
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

## License

Private project — built by [rtrentin](https://rtrentinsworld.com).

# Terraform HLD Generator

Generate formal **High Level Design (HLD)** documents from any Terraform/OpenTofu configuration files using AI.

Upload `.tf`, `.tfvars`, or `.zip` files and choose from three actions:

- **Generate HLD** — structured design document covering network design, security, firewall, DCF, edge devices, components, and data flows
- **Explain Code** — plain-English explanation: summary, resources, architecture, security, variables, dependencies, potential issues
- **Validate Code** — scored code review (0–100) with findings by severity and category

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173, create a model profile, and upload Terraform files.

## Features

| Feature | Description |
|---|---|
| **Universal Terraform Support** | Works with any provider — AWS, Azure, GCP, Aviatrix, and others. System prompt broadened beyond Aviatrix-only |
| **Multi-Provider Model Profiles** | Named profiles for Anthropic, AWS Bedrock (API key), Azure OpenAI, Google Gemini, or any OpenAI-compatible endpoint. Fetch live models, switch in one click |
| **Key Persistence Opt-in** | Keys stored in `sessionStorage` by default (cleared on tab close). Explicit checkbox required to persist to `localStorage`, with security notice |
| **Dynamic Registry Defaults** | Fetches live module defaults from registry.terraform.io for every module detected in uploaded files; 1h cache; Aviatrix modules hardcoded as fallback |
| **Mermaid Diagram** | Auto-rendered LR network topology; re-renders on dark/light toggle |
| **PII Redaction** | IPs, names, BGP ASNs, domains, emails scrubbed client-side before API call; rehydrated after |
| **Variable Resolution** | Resolves `var.X` references from `.tfvars` client-side |
| **Anti-Hallucination** | Strict prompt rules — no invented attachments, VPN connections, or data flows |
| **AI Transparency** | Disclaimer + caveats in HLD and DOCX; unknown vendor stays unknown |
| **Responsible AI** | Body size limits, output filtering, injection sanitization, no server-side key storage |
| **DOCX Export** | Word document with AI disclaimer, caveats, and all HLD sections |
| **ZIP Support** | Auto-extracts `.tf`/`.tfvars` from uploaded ZIP archives |
| **Prompt Versioning & Testing** | Versioned prompt archive in `prompts/`; `npm run test:prompts` (current) or `test:prompts:compare` (all versions side-by-side) |

## Security

- **API keys** — `sessionStorage` by default (cleared on tab close); `localStorage` only on explicit opt-in with security notice
- **PII redaction** — sensitive data scrubbed client-side before any API call
- **Origin allowlist** — API endpoints return 403 for requests outside `*.vercel.app` / localhost
- **Body size limit** — 5 MB cap on all API endpoints
- **Prompt injection** — TF files and user instructions sanitized before sending
- **Output filtering** — explain endpoint rejects off-topic responses
- **Security headers** — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

## Deploy to Vercel

1. Push this repo to GitHub
2. Import into [Vercel](https://vercel.com/new)
3. Deploy — no environment variables required (users supply their own API keys)

## Project Structure

```
terraform-hld-generator/
  api/
    generate.ts         # HLD generation (Anthropic/Bedrock: generateText; others: generateObject)
    explain.ts          # Plain-English code explanation
    validate.ts         # Code validation with scored findings
    list-models.js      # Live model listing per provider
    registry-defaults.js # Live Terraform Registry module defaults
    _origin.js          # Shared origin allowlist
  lib/
    iddSchema.ts        # Zod schema (HLDSchema) for the HLD output
    systemPrompt.ts     # System prompt — universal Terraform support
  src/
    App.tsx             # Entire application (~1300 lines)
    iddTool.ts          # JSON Schema version (reference)
    main.tsx            # React entry point
  public/
    logo.svg            # App logo
    favicon.svg         # Browser tab icon
  prompts/
    v1-aviatrix.ts      # Archived v1 prompt (Aviatrix-focused baseline)
    README.md           # Versioning workflow
  test/
    fixtures/           # Terraform fixtures for promptfoo tests
  promptfoo.yaml        # Prompt regression & versioning test configuration
  vite.config.ts        # Dev server + esbuild (minifyIdentifiers: false)
  vercel.json           # Security headers + rewrites
```

## Tech Stack

- **React 19** + **TypeScript** — UI
- **Vite** — Build tool (`minifyIdentifiers: false` to prevent TDZ crashes)
- **Tailwind CSS 3** — Styling
- **Vercel AI SDK** (`ai`, `@ai-sdk/*`) — Unified LLM client
- **Zod** — Schema validation for structured outputs
- **Mermaid.js** (CDN) — Network topology diagram rendering
- **docx** (CDN) — Word document generation
- **JSZip** (CDN) — ZIP file extraction
- **promptfoo** — Prompt regression testing

## How It Works

1. User uploads Terraform files (`.tf`, `.tfvars`, or `.zip`)
2. Client detects module sources → fetches live defaults from Terraform Registry
3. `.tfvars` values resolved into `var.X` references inline
4. Sensitive data redacted (IPs, names, ASNs, domains, emails)
5. Injection patterns stripped from file content and user instructions
6. Request sent to `/api/generate` (or `/api/explain` / `/api/validate`)
7. Server: `generateText` for Anthropic/Bedrock; `generateObject` for others
8. Response Zod-validated, PII rehydrated, rendered in DocView
9. User exports to DOCX or views Mermaid diagram

## Running Prompt Tests

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run test:prompts          # Test current prompt (v2) only — fast
npm run test:prompts:compare  # Compare all versions side-by-side
npm run test:prompts:view     # Open promptfoo browser UI
```

### Changing the prompt

1. Archive current: `cp lib/systemPrompt.ts prompts/v2-universal.ts`
2. Edit `lib/systemPrompt.ts`
3. Run `npm run test:prompts:compare` — verify no regression before merging

## Local Development

```bash
npm run dev       # Start dev server (localhost:5173)
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

## License

Private project — built by [rtrentin](https://rtrentinsworld.com).

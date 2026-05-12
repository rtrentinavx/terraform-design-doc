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
| **Multi-Provider Model Profiles** | Named profiles for Anthropic, AWS Bedrock (API key), Azure OpenAI, Google Gemini, or any OpenAI-compatible endpoint. Bedrock: live model list via Mantle API, filtered to Amazon/Meta/Mistral/Cohere only |
| **Key Persistence Opt-in** | Keys stored in `sessionStorage` by default (cleared on tab close). Explicit checkbox required to persist to `localStorage`, with security notice |
| **Dynamic Registry Defaults** | Fetches live module defaults from registry.terraform.io for every module detected in uploaded files; 1h cache; Aviatrix modules hardcoded as fallback |
| **Mermaid Diagram** | Auto-rendered LR network topology; re-renders on dark/light toggle |
| **PII Redaction** | IPs, names, BGP ASNs, domains, emails scrubbed client-side before API call; rehydrated after |
| **Variable Resolution** | Resolves `var.X` references from `.tfvars` client-side |
| **Anti-Hallucination** | Strict prompt rules — no invented attachments, VPN connections, or data flows |
| **Aviatrix DCF Extraction** | `aviatrix_smart_group`, `aviatrix_web_group`, and `aviatrix_distributed_firewalling_policy_list` resources are parsed into the HLD's `dcf` section with members, domains, and policy rules. UUID references resolve back to smart_group/web_group names; TLS decryption is flagged from `decrypt_policy` / `tls_profile` |
| **AI Transparency** | Disclaimer + caveats in HLD and DOCX; unknown vendor stays unknown |
| **Responsible AI** | Body size limits, output filtering, injection sanitization, no server-side key storage |
| **Defensive Rendering** | `toStr()`/`toArr()` coerce any model response type — prevents crashes when non-Claude models return objects or strings for array fields |
| **DOCX Export** | Word document with AI disclaimer, caveats, and all HLD sections |
| **ZIP Support** | Auto-extracts `.tf`/`.tfvars` from uploaded ZIP archives |
| **Upstash Redis Caching** | Server-side cache for registry defaults (1h TTL) and model lists (30min TTL) — shared across users; set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel |
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
    _cache.js           # Upstash Redis cache helper (cacheGet/cacheSet)
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
    v2-universal.ts     # Snapshot before broadening to universal Terraform
    v3-no-aviatrix-bias.ts
    v4-component-rules.ts
    v5-schema-template.ts
    v6-json-template.ts
    v7-prose-fields.ts  # Snapshot before adding DCF extraction rules (v8 = live)
    README.md           # Versioning workflow + harness status
  test/
    fixtures/                       # Terraform fixtures for promptfoo tests
      aws-firenet-palo.tf
      aws-firenet-tfvars.tf
      aws-plain-vpc.tf
      no-firewall.tf
      aviatrix-dcf-policies.tf      # SmartGroups / WebGroups / policy_list
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
- **docx** (npm, lazy-loaded) — Word document generation (bundled, no CDN)
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
npm run test:prompts          # Test current prompt (v8) only — fast (when working)
npm run test:prompts:compare  # Compare all versions side-by-side
npm run test:prompts:view     # Open promptfoo browser UI
```

> ⚠️ **The harness is currently broken** — every test that substitutes a fixture via `{{file://...}}` fails with a Nunjucks template-render error (regression in `promptfoo ^0.121.x`). Tests with inline TF content still execute. See [`prompts/README.md`](prompts/README.md) for the status and two recommended fixes (pin promptfoo, or replace the runner with a small Node script that calls the Anthropic SDK directly).

### Changing the prompt

1. Archive current: `cp lib/systemPrompt.ts prompts/vN-<label>.ts` (latest archive is `v7-prose-fields.ts`; the live prompt is v8 — DCF extraction)
2. Edit `lib/systemPrompt.ts`. **Don't put backticks in the prompt body** — they close the surrounding `\`...\`` template literal. Use apostrophes for inline code references.
3. Run `npm run test:prompts:compare` — verify no regression before merging (or, while the harness is broken, run the dev server against the `test/fixtures/*.tf` files manually)

## Local Development

```bash
npm run dev       # Start dev server (localhost:5173)
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

## License

Private project — built by [rtrentin](https://rtrentinsworld.com).

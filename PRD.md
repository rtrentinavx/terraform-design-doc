# Product Requirements Document
## Terraform Design Document Generator
**Version:** 1.7.0 · **Date:** 2026-05-13 · **Status:** Production

---

## 1. Overview

Terraform Design Document Generator is a single-page web application that converts raw Terraform/OpenTofu infrastructure-as-code into formal, shareable High Level Design (HLD) documents — in seconds, using AI.

Engineers upload `.tf` / `.tfvars` files (or a ZIP archive), choose an AI model, and receive a structured document covering network design, security, data flows, components, and more. The output can be exported as a Word document (`.docx`), a draw.io diagram (`.drawio`), or shared via a permanent link.

**Live app:** deployed on Vercel  
**Stack:** React + TypeScript (Vite) · Vercel serverless functions · Upstash Redis · Vercel AI SDK

---

## 2. Problem Statement

After writing or reviewing Terraform code, infrastructure and network engineers still have to manually produce design documentation for handoffs, reviews, and audits. This is:

- **Time-consuming** — a typical HLD takes hours to write and maintain
- **Error-prone** — documentation drifts from code over time
- **Inconsistent** — every engineer produces a different structure and level of detail
- **Inaccessible** — non-engineers (security, management) cannot easily read `.tf` files

---

## 3. Target Users

| Persona | Use case |
|---|---|
| Infrastructure / Cloud Engineer | Generate HLD documentation after writing Terraform code |
| Network Engineer | Understand multi-VPC topologies; export editable diagrams to draw.io |
| Security Engineer | Review firewall placement, data flows, and security posture |
| Solutions Architect | Create customer-facing architecture documentation |
| Technical Manager / Auditor | Review infrastructure without reading raw Terraform |

---

## 4. Core Features

### 4.1 HLD Generation

Analyzes any Terraform/OpenTofu configuration and produces a structured High Level Design with:

- **Overview** — executive summary, design pattern, providers, regions
- **Network Design** — VPCs/VNets with CIDRs, subnets, transit gateways, routing
- **Security** — firewall details, security groups, policies, IAM roles
- **Edge & External** — on-prem connections, CDN, DNS, external endpoints
- **Components** — all infrastructure resources categorized by function (compute, network, storage, security, etc.)
- **Data Flows** — traffic paths showing how requests traverse gateways, firewalls, and network segments
- **Variables & Outputs** — Terraform variable declarations, outputs, and module dependencies
- **Connectivity Matrix** — VPC-to-VPC reachability grid computed from `connected_transit` fields
- **Mermaid Diagram** — auto-rendered network topology, re-renders on dark/light theme switch
- **Aviatrix DCF Policies** — `aviatrix_smart_group`, `aviatrix_web_group`, and `aviatrix_distributed_firewalling_policy_list` resources extracted into the HLD's DCF tab with members, domains, and rule rows; UUID references resolved back to smart_group / web_group names via the Terraform reference graph; TLS decryption flagged from `decrypt_policy` / `tls_profile`

**Two-pass generation:** Pass 1 generates the full HLD. Pass 2 runs a lightweight delta critique (2,000 tokens max) that removes invented components, corrects wrong CIDRs, and appends caveats — applied programmatically without regenerating the full document.

### 4.2 Explain Code

Plain-English explanation covering: summary, resource inventory, architecture pattern, security posture, variable usage, module dependencies, and potential issues.

### 4.3 Validate Code

Scored code review (0–100) with findings grouped by severity (Critical / High / Medium / Low) and category: Security, Best Practice, Cost, Reliability, Aviatrix-specific, and Syntax.

### 4.4 Multi-Model Support

Named profiles with support for:

| Provider | Notes |
|---|---|
| Anthropic (Claude) | Direct API |
| AWS Bedrock | Live model list via Mantle API |
| Azure OpenAI | Deployment-based endpoint |
| Google Gemini | `generateObject` with Zod schema enforcement |
| OpenAI | GPT-4o and variants |
| Any OpenAI-compatible endpoint | Custom base URL |
| LM Studio | Browser → localhost direct (no Vercel) |
| Ollama | Browser → localhost direct (no Vercel) |

Per-profile: API key, model, base URL, temperature, and key persistence option.

### 4.5 Local Model Support

LM Studio and Ollama are called **directly from the browser** — Terraform code never leaves the user's machine. The app detects local providers and bypasses Vercel entirely.

- Tested on Firefox and Safari
- Chrome/Chromium blocked by Private Network Access policy (HTTPS→localhost)

### 4.6 Export — DOCX

Word document export with AI-generated disclaimer, caveats, and all HLD sections. Bundled via npm (no CDN dependency at export time).

### 4.7 Export — draw.io

Downloads a `.drawio` XML file with:
- VPC swimlane containers per cloud/region
- Components colour-coded by category
- Transit / spoke / FireNet / DCF nodes
- Edge and external devices
- Data flow edges

Open in [diagrams.net](https://diagrams.net) or import into Visio.

### 4.8 Shareable Links

Share a generated HLD via URL. The document is stored in Upstash Redis with a UUID key (30-day TTL, 512 KB max). The recipient loads the HLD directly from the share URL — no login required.

### 4.9 Client-side PII Redaction

Before sending content to the AI:
- Public IPs, BGP ASNs, customer names, domains, and emails are replaced with generic tokens
- The redaction map stays in the browser (never sent to any server)
- After generation, values are rehydrated in the output

### 4.10 Variable Resolution

Resolves `var.X` references from uploaded `.tfvars` files client-side, so the AI model sees actual values rather than variable references.

### 4.11 Dynamic Registry Defaults

Fetches live module defaults from `registry.terraform.io` for every detected module. Results are cached server-side via Upstash Redis (1-hour TTL). Aviatrix modules are hardcoded as fallback.

### 4.12 DCF Policy Suggestion (Aviatrix)

Generates a tentative Aviatrix Distributed Cloud Firewall configuration — SmartGroups, WebGroups, rulesets, and Terraform HCL — based on discovered network segments.

---

## 5. Security & Privacy

| Concern | Approach |
|---|---|
| API key storage | `sessionStorage` by default (cleared on tab close); `localStorage` requires explicit opt-in with security notice |
| PII in Terraform code | Client-side redaction before any API call |
| Prompt injection | TF content and Additional Instructions field sanitized against injection patterns |
| API key exposure | Keys sent to Vercel only for cloud providers; never logged or stored server-side |
| Local models | Terraform code stays on device — Vercel is not involved |
| HTTP headers | CSP, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy |
| API origin allowlist | `*.vercel.app` + localhost only |
| Body size limit | 5 MB max on all API endpoints |

---

## 6. Non-Functional Requirements

| Requirement | Spec |
|---|---|
| Serverless function timeout | 300 s (Vercel Pro plan) |
| Max request body | 5 MB |
| Share document max size | 512 KB |
| Share TTL | 30 days |
| Registry defaults cache | 1 hour (Upstash Redis) |
| Model list cache | 30 minutes (Upstash Redis) |
| Error reporting | Sentry (with `flush` before function exit) |
| Browser support | Modern evergreen; local model support on Firefox and Safari |

---

## 7. Architecture

```
Browser (React SPA)
  │
  ├── Cloud providers ──► Vercel Serverless Functions
  │                         ├── /api/generate    (HLD generation, 2-pass)
  │                         ├── /api/explain     (plain-English explanation)
  │                         ├── /api/validate    (code review)
  │                         ├── /api/share       (Redis store/retrieve)
  │                         ├── /api/list-models (Bedrock model list)
  │                         └── /api/registry-defaults
  │                                   │
  │                                   ├── Anthropic / OpenAI / Gemini / Azure / Bedrock
  │                                   └── Upstash Redis (caching + share storage)
  │
  └── Local providers ──► localhost:1234 (LM Studio)
                        └── localhost:11434 (Ollama)
```

**Frontend state management:** React `useState` / `useRef` — no external state library.  
**AI SDK:** Vercel AI SDK (`generateText` for Anthropic/Bedrock, `generateObject` for OpenAI/Gemini/Azure).  
**Schema validation:** Zod (`HLDSchema`) — output validated on every generation path.  
**Prompt versioning:** `lib/systemPrompt.ts` versioned in `prompts/` (current iteration: v8 — DCF SmartGroup / WebGroup extraction). `promptfoo` regression suite is wired up but the templating layer is currently broken on `^0.121.x`; manual fixture validation via the dev server is the workaround until the harness is repinned or rewritten.

---

## 8. Roadmap

| Item | Status |
|---|---|
| Rate limiting per-IP on API proxy | Done — sliding window, 20 req/h (AI), 30 req/h (share) via Upstash Redis |
| PDF export | Considering |
| Multi-file diff / infrastructure change detection | Exploring |
| Saved document history | Exploring |

---

## 9. Out of Scope

- Authentication / user accounts
- Real-time collaboration
- Terraform plan / apply integration
- Cloud provider live resource discovery (read-only API access)

---

*Built by rtrentin · AI-powered · Multi-model*

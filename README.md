# Terraform Design Document Generator

Generate formal **Infrastructure Design Documents** from Terraform/OpenTofu configuration files using AI.

Upload your `.tf`, `.tfvars`, or `.zip` files and get a comprehensive design document with:

- Network topology diagrams — SVG, Mermaid, and MockFlow (BETA) options
- VPC/subnet architecture with gateway sizing and provider logos (AWS, Azure, GCP)
- Firewall details (Palo Alto, Fortinet, Check Point) with HA configuration
- Distributed Cloud Firewall (DCF) policies, smart groups, and rule analysis
- Edge device inventory and external connections
- Component catalog, data flows, and variable documentation
- One-click **DOCX export** with embedded diagrams and formatted tables

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173, enter your [Anthropic API key](https://console.anthropic.com), and upload Terraform files.

## Features

| Feature | Description |
|---|---|
| **AI Analysis** | Claude analyzes Terraform configs and extracts architecture details with anti-hallucination rules |
| **3 Diagram Modes** | SVG topology, Mermaid flowchart (LR layout), and MockFlow IdeaBoard (BETA) |
| **PII Redaction** | Public IPs, customer names, ASNs, domains and emails are scrubbed client-side before the API call and rehydrated after |
| **Additional Instructions** | Collapsible field to append context Claude can't infer from Terraform alone |
| **Dark/Light Mode** | Full theme support including diagram colors |
| **DOCX Export** | Professional Word document with tables and embedded diagram |
| **ZIP Support** | Upload entire Terraform project as ZIP; auto-extracts `.tf`/`.tfvars` files |
| **Aviatrix Defaults** | Knows default gateway sizes, firewall instances, and module configurations for Aviatrix Terraform provider |
| **Customer Name** | Personalize the generated document with a customer name |
| **Model Selection** | Choose between Claude Sonnet, Opus, or Haiku |

## Security

- **API key** — stored in browser localStorage only; forwarded directly to Anthropic per request, never stored server-side
- **PII redaction** — public IPs, customer names, ASNs, domain names, and emails are replaced with tokens before the API call; real values are rehydrated locally after the response
- **Origin allowlist** — API proxy endpoints (`/api/analyze`, `/api/mockflow`) reject requests from outside `*.vercel.app` and localhost with 403
- **Security headers** — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy applied on all routes
- **No shared API key** — users supply their own Anthropic API key; no server-side secret required

## Deploy to Vercel

1. Push this repo to GitHub
2. Import into [Vercel](https://vercel.com/new)
3. Deploy — no environment variables required (users bring their own API key)

The `api/analyze.js` serverless function proxies requests to the Anthropic API, forwarding the client's `x-api-key` header.

## Project Structure

```
terraform-design-doc/
  api/
    analyze.js          # Vercel serverless proxy to Anthropic API
    mockflow.js         # Vercel serverless proxy to MockFlow MCP
    _origin.js          # Shared origin allowlist for API routes
  src/
    App.tsx             # Entire application (~1800 lines)
    main.tsx            # React mount point
    index.css           # Tailwind imports
  index.html            # Vite entry point
  vite.config.ts        # Dev server with API proxy + security headers
  vercel.json           # Security headers + rewrite rules
  tailwind.config.js    # Tailwind configuration
```

## Tech Stack

- **React 19** + **TypeScript** — UI
- **Vite** — Build tool and dev server
- **Tailwind CSS 3** — Styling
- **Claude API** (Anthropic) — AI analysis (temperature 0 for deterministic output)
- **Mermaid.js** (CDN) — Flowchart diagram rendering
- **docx** (CDN) — Word document generation
- **JSZip** (CDN) — ZIP file extraction

## How It Works

1. User uploads Terraform files (`.tf`, `.tfvars`, or `.zip`)
2. Sensitive data is redacted client-side (IPs, names, ASNs, domains)
3. Files are sent to Claude with a structured system prompt + optional user instructions
4. Claude returns a JSON object matching a predefined schema (network design, security, compute, firewalls, DCF, edge devices, etc.)
5. Redacted values are rehydrated back into the parsed JSON
6. The app renders the JSON as a rich, tabbed document with network diagrams
7. Users can export to DOCX or open an interactive MockFlow diagram

## Local Development

The Vite dev server proxies `/api/analyze` and `/api/mockflow` to their respective upstream APIs, stripping browser headers to avoid CORS. Your API key is sent from the browser as an `x-api-key` header.

```bash
npm run dev       # Start dev server (localhost:5173)
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

## License

Private project.

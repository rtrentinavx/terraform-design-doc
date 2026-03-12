# Terraform Design Document Generator

Generate formal **Infrastructure Design Documents** from Terraform/OpenTofu configuration files using AI.

Upload your `.tf`, `.tfvars`, or `.zip` files and get a comprehensive design document with:

- Network topology diagrams with cloud provider logos (AWS, Azure, GCP)
- VPC/subnet architecture with gateway sizing
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
| **AI Analysis** | Uses Claude to parse Terraform configs and extract architecture details |
| **Network Diagram** | SVG-based topology with animated connections, provider logos, and conditional Internet/On-Prem nodes |
| **Dark/Light Mode** | Full theme support including diagram colors |
| **DOCX Export** | Professional Word document with tables and embedded diagram image |
| **ZIP Support** | Upload entire Terraform project as ZIP; auto-extracts `.tf`/`.tfvars` files |
| **Aviatrix Defaults** | Knows default gateway sizes, firewall instances, and module configurations for Aviatrix Terraform provider |
| **Customer Name** | Personalize the generated document with a customer name |
| **Model Selection** | Choose between Claude Sonnet, Opus, or Haiku |

## Deploy to Vercel

1. Push this repo to GitHub
2. Import into [Vercel](https://vercel.com/new)
3. Add environment variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** Your Anthropic API key
4. Deploy

The `api/analyze.js` serverless function proxies requests to the Anthropic API. Your API key stays server-side and is never exposed to the browser.

## Project Structure

```
terraform-design-doc/
  api/
    analyze.js          # Vercel serverless proxy to Anthropic API
  src/
    App.tsx             # Entire application (components, diagram, export)
    main.tsx            # React mount point with error boundary
    index.css           # Tailwind imports
  index.html            # Vite entry point
  vite.config.ts        # Dev server with API proxy config
  vercel.json           # Vercel rewrite rules
  tailwind.config.js    # Tailwind configuration
```

## Tech Stack

- **React 19** + **TypeScript** — UI
- **Vite** — Build tool and dev server
- **Tailwind CSS 3** — Styling
- **Claude API** (Anthropic) — AI analysis
- **docx** (CDN) — Word document generation
- **JSZip** (CDN) — ZIP file extraction

## How It Works

1. User uploads Terraform files (`.tf`, `.tfvars`, or `.zip`)
2. Files are concatenated and sent to Claude with a structured system prompt
3. Claude returns a JSON object matching a predefined schema covering network design, security, compute, firewalls, DCF, edge devices, and more
4. The app renders the JSON as a rich, tabbed document with an SVG network diagram
5. Users can export to DOCX with embedded diagram and formatted tables

## Local Development

The Vite dev server proxies `/api/analyze` to `https://api.anthropic.com/v1/messages`, stripping browser headers to avoid CORS issues. Your API key is sent from the browser as an `x-api-key` header during local development.

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run preview   # Preview production build
```

## License

Private project.

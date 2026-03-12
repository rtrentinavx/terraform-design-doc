# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-page React app that analyzes Terraform/OpenTofu configurations via the Claude API and generates a formatted Infrastructure Design Document (IDD). Users upload `.tf`/`.tfvars` files (or ZIP archives), the app sends them to Claude with a structured JSON system prompt, and renders the parsed response as a rich document with network diagrams, component tables, firewall details, DCF policies, and DOCX export.

## Commands

- `npm run dev` — Start Vite dev server with API proxy (localhost:5173)
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build locally

## Architecture

The entire application lives in `src/App.tsx` — a single ~1100-line file. No router or state management library. Key sections in order:

1. **Constants & config** (top): Model list, API URL (`/api/analyze` proxy)
2. **Safe storage helpers** (`sg`/`ss`/`sd`): localStorage with in-memory fallback
3. **Theme** (`DARK`/`LIGHT`/`AV`): Dark/light mode color palettes
4. **System prompt** (`SYS`): Structured prompt instructing Claude to return JSON matching a specific schema (network design, firewalls, edge devices, DCF, etc.) with Aviatrix Terraform module defaults
5. **SVG icon paths** (`IC`): Inline icon definitions for the network diagram
6. **Cloud provider logos** (`ProvLogo`, `AvxLogo`, `FwLogo`): SVG logo components for AWS, Azure, GCP, Aviatrix, and firewall vendors (Palo Alto, Fortinet, Check Point)
7. **Diagram component**: SVG-based network topology renderer with theme-aware colors, animated flow dots, conditional Internet/On-Prem nodes, cloud region containers, and provider watermarks
8. **DOCX export** (`exportDocx`): Generates Word documents with tables, embedded diagram PNG (via canvas), and structured sections. Uses `docx` library loaded from CDN.
9. **DocView component**: Tabbed document viewer (Overview, Network, Security, DCF, Edge, Components, Diagram, Flows, Variables)
10. **App component**: API key input, customer name, file upload/ZIP extraction, model selection, dark mode toggle, API calls with progress bar, JSON parsing with truncation recovery

## Deployment

- **Local dev**: Vite proxy in `vite.config.ts` rewrites `/api/analyze` → `https://api.anthropic.com/v1/messages` (strips Origin/Referer headers to avoid CORS)
- **Vercel**: `api/analyze.js` serverless function proxies to Anthropic. Set `ANTHROPIC_API_KEY` in Vercel environment variables. `vercel.json` rewrites `/api/*` to the serverless function.

## Key Conventions

- Compressed variable names: `AV` (theme), `SYS` (system prompt), `sg`/`ss`/`sd` (storage), `IC` (icons), `PC`/`PC2` (provider colors)
- All styling: Tailwind CSS utilities + inline `style` props referencing `AV` theme object
- Claude API response must be valid JSON matching the schema in `SYS` — parsed with `JSON.parse` after stripping markdown fences, with auto-repair for truncated responses
- Network diagram layout is computed procedurally (no layout library) with manual coordinate math
- Diagram conditionally shows Internet/On-Prem nodes based on data evidence (public subnets, egress rules, external connections, edge devices)
- SVG `<g>` elements must be used instead of React Fragments (`<>`) inside SVG — fragments crash React in SVG context

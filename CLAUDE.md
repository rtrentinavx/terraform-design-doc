# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-page React app that analyzes Terraform/OpenTofu configurations via the Claude API and generates a formatted Infrastructure Design Document (IDD). Users paste Terraform code, the app sends it to Claude with a structured JSON system prompt, and renders the parsed response as a rich document with network diagrams, component tables, firewall details, and DCF policies.

## Architecture

The entire application lives in **terraform-agent.tsx** — a single ~1600-line React component file (JSX with inline Tailwind CSS). There is no build system, router, or state management library. Key sections in order:

1. **Constants & config** (lines 1–13): Model list, deployment detection (`IS_DEP`), API URL switching between direct Anthropic calls and `/api/analyze` proxy
2. **Safe storage helpers** (`sg`/`ss`/`sd`): localStorage with in-memory fallback
3. **Theme constants** (`AV`): color palette object used throughout
4. **System prompt** (`SYS`): Large structured prompt that instructs Claude to return a specific JSON schema covering network design, firewalls, edge devices, DCF, etc.
5. **SVG icon paths** (`IC`): Inline icon definitions for the network diagram
6. **Diagram component** (`Diagram`): SVG-based network topology renderer — positions VPCs, subnets, gateways, edge devices, and draws connections
7. **Main `App` component**: Handles API key input, file upload, model selection, API calls, JSON parsing, and renders the full document with collapsible sections

## Deployment

Two modes controlled by `window.VITE_DEPLOYED`:
- **Standalone/Claude artifact**: Calls Anthropic API directly; user provides their own API key
- **Vercel-deployed**: Calls `/api/analyze` serverless proxy (see `vercel-setup.md`); API key stored server-side

Target project structure for deployment is documented in `vercel-setup.md` (Vite + React template with an `api/analyze.js` serverless function).

## Key Conventions

- Extremely compressed variable names throughout (e.g., `AV` for theme, `SYS` for system prompt, `sg`/`ss`/`sd` for storage, `IC` for icons)
- All styling uses Tailwind CSS utility classes plus inline `style` props referencing the `AV` theme object
- The Claude API response must be valid JSON matching the schema in `SYS` — the app parses it with `JSON.parse` after stripping markdown fences
- Network diagram layout is computed procedurally (no layout library) with manual coordinate math

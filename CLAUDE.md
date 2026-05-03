# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-page React app that analyzes Terraform/OpenTofu configurations via AI and generates Infrastructure Design Documents (IDD). Users upload `.tf`/`.tfvars` files (or ZIP archives), the app redacts PII client-side, resolves variables, and sends content to an LLM. It renders the parsed response as a rich tabbed document with a Mermaid network diagram, and supports three actions: Generate IDD, Explain Code, Validate Code.

## Commands

- `npm run dev` — Start Vite dev server (localhost:5173)
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build
- `npm run test:prompts` — Run promptfoo regression tests (requires `ANTHROPIC_API_KEY`)
- `npm run test:prompts:view` — Open promptfoo web UI

## Architecture

### Frontend — `src/App.tsx` (~1300 lines)

Key sections in order:

1. **Constants & types** — `APP_VERSION`, `ModelProfile` type, `PROVIDERS`, `PROVIDER_COLORS`, profile helpers
2. **ProfileEditor / ProfileSwitcher** — modal components for managing named model profiles (provider + key + model + optional base URL)
3. **Theme** (`DARK`/`LIGHT`/`AV`) — `AV` is a module-level `let` reassigned on every App render; all components read it at render time
4. **Shared UI helpers** — `UISec`/`UIPr`/`UIKV`/`UItr` defined as **function declarations** (not const arrows) to avoid esbuild TDZ crashes; aliased as `Sec`/`Pr`/`KV`/`tr`
5. **System prompt** (`SYS`) — in `src/App.tsx` for client use; canonical version in `lib/systemPrompt.ts` used by API
6. **Mermaid diagram** (`buildMermaid`) — LR flowchart from IDD network data; `initMermaid` reinitializes theme on dark/light switch
7. **`useJSZip` / `useDocx` / `exportDocx`** — CDN-loaded libraries; `exportDocx` includes AI disclaimer and caveats section
8. **`DocView` component** — tabbed viewer (Overview, Network, Security, DCF, Edge, Components, Diagram, Flows, Variables); auto-renders Mermaid on tab open and dark/light toggle
9. **`App` component** — profile management, file upload/ZIP extraction, variable resolution, PII redaction, registry defaults fetch, three action buttons (Generate IDD, Explain, Validate), progress bar, About modal

### API (Vercel serverless)

| File | Purpose |
|---|---|
| `api/generate.ts` | Main IDD generation. Anthropic/Bedrock → `generateText` + JSON parse + Zod validate. OpenAI/Gemini/Custom → `generateObject` with Zod schema |
| `api/explain.ts` | Plain-English code explanation via `generateText`. Includes output content filter |
| `api/validate.ts` | Code validation via `generateObject` with `ValidationSchema` (severity, category, score) |
| `api/list-models.js` | Live model listing per provider. Bedrock returns curated static list |
| `api/registry-defaults.js` | Fetches module defaults from registry.terraform.io for detected modules + Aviatrix fallback |
| `api/_origin.js` | Shared origin allowlist: `*.vercel.app` + localhost |

### Shared library — `lib/`

- `lib/iddSchema.ts` — Zod schema for IDD output (includes `caveats: z.array(z.string())`)
- `lib/systemPrompt.ts` — Canonical system prompt used by API functions and promptfoo tests

### Tests — `test/` + `promptfoo.yaml`

- Fixtures: `test/fixtures/*.tf` + `.tfvars`
- Test cases: firewall detection (explicit + via tfvars), anti-hallucination (no fake firewall, no fake spokes), provider detection, schema completeness

## Deployment

- **Local dev**: Vite proxy rewrites `/api/*` to serverless handlers (simulated via local routes for non-Anthropic)
- **Vercel**: serverless functions in `api/`. No shared API keys — users supply their own per profile. `vercel.json` applies security headers

## Critical Conventions

### TDZ / Minifier Safety
- `esbuild.minifyIdentifiers: false` in `vite.config.ts` — MUST NOT be removed. Without it, esbuild renames variables to single letters causing "Cannot access X before initialization" crashes
- All module-level and component-level component helpers MUST be `function` declarations, not `const` arrow functions
- All React `useState` declarations in `App` MUST come before any `useEffect` that references them in dependency arrays

### Theme
- `AV` is a module-level `let` reassigned at the start of every `App` render: `AV = dark ? DARK : LIGHT`
- Components read `AV` at render time — consistent within a single render pass

### PII Redaction
- `buildRedactionMap()` builds forward map (real → token); stored in `redMapRef` (useRef) so MockFlow / explain / validate can reuse it
- Rehydration applied to parsed JSON before `setDoc()`
- `INJECT_RE` regex strips prompt injection from TF content AND Additional Instructions field

### AI Provider Routing
- Anthropic + Bedrock: `generateText()` → manual JSON parse + repair → Zod `safeParse`
- OpenAI / Gemini / Custom: `generateObject()` with Zod schema
- Reason: Anthropic's grammar-based tool enforcement rejects schemas above a certain complexity

### Gradient text spans
- `background-clip: text` requires `display: inline-block` on the span
- Add `key={dark?"d":"l"}` to force DOM remount on theme switch (browser doesn't re-apply clip in-place)

### SVG in React
- Use `<g>` instead of `<>` fragments inside SVG — fragments crash React in SVG context

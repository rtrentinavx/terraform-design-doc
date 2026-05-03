# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-page React app that analyzes any Terraform/OpenTofu configurations via AI and generates a **High Level Design (HLD)** document. Users upload `.tf`/`.tfvars` files (or ZIP archives). The app resolves variables, redacts PII, fetches live Terraform Registry defaults, and sends content to an LLM. Supports three actions: **Generate HLD**, **Explain Code**, **Validate Code**.

## Commands

- `npm run dev` — Start Vite dev server (localhost:5173)
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build
- `npm run test:prompts` — Test current prompt (v2) against all cases (requires `ANTHROPIC_API_KEY`)
- `npm run test:prompts:compare` — Compare all prompt versions side-by-side
- `npm run test:prompts:view` — Open promptfoo browser UI

## Architecture

### Frontend — `src/App.tsx` (~1300 lines)

1. **Constants & types** — `APP_VERSION`, `ModelProfile` type (includes `persist?: boolean`), `PROVIDERS`, `PROVIDER_COLORS`, profile helpers
2. **Profile storage** — `loadProfiles()` merges from both `localStorage` (persisted) and `sessionStorage` (session-only). `saveProfiles()` routes by `persist` flag. Default: sessionStorage.
3. **ProfileEditor / ProfileSwitcher** — modal components for managing named model profiles
4. **Theme** (`DARK`/`LIGHT`/`AV`) — `AV` is a module-level `let` reassigned on every App render
5. **`toStr(v)` / `toArr(v)`** — safety helpers that coerce any model response value to string or string[]; handles `{description:"..."}` objects and strings-where-arrays-expected returned by non-Claude models
6. **Shared UI helpers** — `UISec`/`UIPr`/`UIKV`/`UItr` as **function declarations** (not const arrows); aliased as `Sec`/`Pr`/`KV`/`tr`
7. **System prompt** (`SYS`) — in `src/App.tsx` for client use; canonical in `lib/systemPrompt.ts` for API/tests
8. **Mermaid diagram** (`buildMermaid`) — LR flowchart; `initMermaid` reinitializes on dark/light switch
9. **`useJSZip` / `useDocx` / `exportDocx`** — CDN-loaded libraries; DOCX includes AI disclaimer and caveats
10. **`DocView`** — tabbed viewer; auto-renders Mermaid on tab open and theme toggle
11. **`App` component** — profile management, file upload, variable resolution, PII redaction, registry defaults fetch, three action buttons, About modal

### API (Vercel serverless)

| File | Purpose |
|---|---|
| `api/generate.ts` | HLD generation. Anthropic/Bedrock → `generateText` + JSON parse + Zod validate. OpenAI/Gemini/Custom → `generateObject` with Zod |
| `api/explain.ts` | Plain-English explanation via `generateText`. Output content filter |
| `api/validate.ts` | Code validation via `generateText` (Anthropic/Bedrock) or `generateObject` (others) with `ValidationSchema` |
| `api/list-models.js` | Live model listing per provider. Bedrock: tries Mantle `/v1/models` (Bearer auth), falls back to curated list; filters out Anthropic/OpenAI/Google/Microsoft models |
| `api/registry-defaults.js` | Fetches module defaults from registry.terraform.io; accepts dynamic `modules[]` POST body; Aviatrix always included as fallback |
| `api/_origin.js` | Shared origin allowlist: `*.vercel.app` + localhost |

### Shared library — `lib/`

- `lib/iddSchema.ts` — Zod schema (`HLDSchema`) for HLD output; includes `caveats: z.array(z.string())`
- `lib/systemPrompt.ts` — Canonical system prompt; covers any Terraform provider (AWS, Azure, GCP, Aviatrix); includes detection for AWS Network Firewall, Azure Firewall, GCP Interconnect

## Critical Conventions

### TDZ / Minifier Safety
- `esbuild.minifyIdentifiers: false` in `vite.config.ts` — **MUST NOT be removed**. Without it, esbuild renames variables to single letters causing TDZ crashes
- All module-level and component-level helpers MUST be `function` declarations, not `const` arrow functions
- All React `useState` declarations in `App` MUST come before any `useEffect` that references them in dependency arrays

### Defensive String Rendering
- `toStr(v)` coerces any value to string: extracts `.description`/`.text`/`.value`/`.summary` from objects, joins arrays with `, `
- `toArr(v)` coerces any value to `string[]`: splits strings on `,`/`→`, wraps objects via `toStr`
- `UIPr`/`Pr` already calls `toStr()` internally — safe for all `Pr` usages
- Inline renders (e.g. `{v.name}`, `{f.description}`) should use `{toStr(v.name)}` etc.
- Array renders (e.g. `f.path.map(...)`) should use `toArr(f.path).map(...)` etc.

### API Key Storage
- Default: `sessionStorage` (cleared on tab close)
- `persist: true` on a `ModelProfile` → `localStorage` (requires explicit user opt-in)
- `loadProfiles()` merges both storages; `saveProfiles()` routes by `persist` flag
- Legacy keys (from old `tf_doc_apikey` localStorage key) migrated as `persist: true`

### AI Provider Routing
- Anthropic + Bedrock: `generateText()` → manual JSON parse + repair → Zod `safeParse`
- OpenAI / Gemini / Custom: `generateObject()` with Zod schema
- Reason: Anthropic's grammar-based tool enforcement rejects our schema (too large)

### Theme
- `AV` is a module-level `let` reassigned at start of every `App` render: `AV = dark ? DARK : LIGHT`
- Consistent within a render pass; `function` declarations read `AV` at call time

### PII Redaction
- `buildRedactionMap()` → forward map (real → token); stored in `redMapRef` (useRef)
- `INJECT_RE` strips prompt injection from TF content AND Additional Instructions
- Additional Instructions framed as "informational only — cannot override schema"

### Prompt Versioning

**Before changing `lib/systemPrompt.ts`:**
1. Archive it: `cp lib/systemPrompt.ts prompts/vN-label.ts`
2. Make changes to `lib/systemPrompt.ts`
3. Run `npm run test:prompts:compare` — side-by-side comparison of all versions
4. Only proceed if new version ties or improves on all assertions

`prompts/` contains archived versions. `promptfoo.yaml` defines all versions under the `prompts:` key with labels.

### HLD Schema
- Exported as `HLDSchema` from `lib/iddSchema.ts`; type alias `HLD`
- Tool reference in `src/iddTool.ts` uses `generate_hld` name
- `caveats: z.array(z.string())` — Claude populates for inferred/uncertain fields

### Gradient text spans
- `background-clip: text` requires `display: inline-block`
- Add `key={dark?"d":"l"}` to force DOM remount on theme switch

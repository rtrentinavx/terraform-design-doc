# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-page React app that analyzes any Terraform/OpenTofu configurations via AI and generates a **High Level Design (HLD)** document. Users upload `.tf`/`.tfvars` files (or ZIP archives). The app resolves variables, redacts PII, fetches live Terraform Registry defaults, and sends content to an LLM. Supports three actions: **Generate HLD**, **Explain Code**, **Validate Code**.

## Commands

- `npm run dev` — Start Vite dev server (localhost:5173)
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build
- `npm run test:prompts` — Test current prompt (v8) against all cases (requires `ANTHROPIC_API_KEY`). **Currently broken** — see Prompt Versioning below
- `npm run test:prompts:compare` — Compare all prompt versions side-by-side (same harness issue applies)
- `npm run test:prompts:view` — Open promptfoo browser UI

## Architecture

### Frontend — `src/App.tsx` (~1500 lines)

Key sections in order:

1. **Constants & types** — `APP_VERSION`, `ModelProfile` type (includes `persist?: boolean`), `PROVIDERS`, `PROVIDER_COLORS`, profile helpers (`loadProfiles`, `saveProfiles`, `newProfile`, `autoName`)
2. **`ProfileEditor` / `ProfileSwitcher`** — modal components for named model profiles (provider + API key + model + optional base URL + persist flag)
3. **Theme** (`DARK`/`LIGHT`/`AV`) — `AV` is a module-level `let` reassigned on every App render
4. **`toStr(v)` / `toArr(v)`** — safety helpers that coerce any model response value to string or string[]; handles `{description:"..."}` objects and strings-where-arrays-expected returned by non-Claude models
5. **`catStyle(category)`** — returns inline hex styles for component cards (not Tailwind classes — those get purged)
6. **Shared UI helpers** — `UISec`/`UIPr`/`UIKV`/`UItr` as **function declarations** (not const arrows); aliased as `Sec`/`Pr`/`KV`/`tr`
7. **`buildMermaid(doc, dark)`** — generates Mermaid `flowchart TD` from HLD data; shows VPCs as subgraphs with subnets, components, data flow connections, and external nodes
8. **`useJSZip` / `useDocx` / `waitForDocx` / `exportDocx`** — CDN-loaded libraries; `waitForDocx()` polls until ready (avoids "library not loaded" race); DOCX includes AI disclaimer and caveats
9. **`DocView`** — tabbed viewer; DCF and Edge tabs only shown when data is present; auto-renders Mermaid on tab open and dark/light toggle
10. **`App` component** — profile management, file upload, variable resolution, PII redaction, registry defaults fetch, three action buttons, token metrics chip, About modal

### API (Vercel serverless)

| File | Purpose |
|---|---|
| `api/generate.ts` | HLD generation. Anthropic/Bedrock → `generateText` + JSON parse + Zod `safeParse`. OpenAI/Gemini/Custom → `generateObject` with Zod. Default `maxTokens=8000` |
| `api/explain.ts` | Plain-English explanation via `generateText`. Prompt includes Mermaid diagram instruction. Output content filter |
| `api/validate.ts` | Code validation via `generateText` (Anthropic/Bedrock) or `generateObject` (others) |
| `api/list-models.js` | Live model listing. Bedrock: tries Mantle `/v1/models` (Bearer auth), falls back to curated list; filters out Anthropic/OpenAI/Google/Microsoft models |
| `api/registry-defaults.js` | Fetches module defaults from registry.terraform.io; dynamic `modules[]` POST body; Aviatrix always included as fallback |
| `api/_cache.js` | Upstash Redis helper: `cacheGet(key)` / `cacheSet(key, val, ttl)`. No-ops gracefully when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env vars not set |
| `api/_origin.js` | Shared origin allowlist: `*.vercel.app` + localhost |

**Dead code** (do not use): `api/analyze.js`, `api/openai-proxy.js` — superseded by `api/generate.ts`.

### Shared library — `lib/`

- `lib/iddSchema.ts` — Zod schema (`HLDSchema`) for HLD output; includes `caveats: z.array(z.string())`
- `lib/systemPrompt.ts` — Canonical system prompt used by API functions and promptfoo tests. Covers any Terraform provider. **Archive before changing** (see Prompt Versioning below)

### Prompt versions — `prompts/`

Archived system prompt versions for regression comparison. `promptfoo.yaml` references all versions. Add new entries when iterating on the prompt.

## Critical Conventions

### TDZ / Minifier Safety
- `esbuild.minifyIdentifiers: false` in `vite.config.ts` — **MUST NOT be removed**. Without it, esbuild renames variables to single letters causing "Cannot access X before initialization" crashes
- All module-level and component-level helpers MUST be `function` declarations, not `const` arrow functions
- All React `useState` declarations in `App` MUST come before any `useEffect` that references them in dependency arrays

### Defensive String Rendering
- `toStr(v)` coerces any value to string: extracts `.description`/`.text`/`.value`/`.summary` from objects, joins arrays with `, `
- `toArr(v)` coerces any value to `string[]`: splits strings on `,`/`→`, wraps objects via `toStr`
- `UIPr`/`Pr` already calls `toStr()` internally — safe for all `Pr` usages
- Inline renders (e.g. `{v.name}`, `{f.description}`) should use `{toStr(v.name)}` etc.
- Array renders (e.g. `f.path.map(...)`) should use `toArr(f.path).map(...)` etc.
- Component cards use `catStyle(category)` for inline hex styles — **never use dynamic Tailwind class strings** (they get purged at build time)

### Field Name Fallbacks
Non-Claude models return different JSON field names. Always try multiple alternatives:
- Component name: `c.name || c.resource_name || c.component_name || c.id`
- Flow description: `f.description || f.details || f.summary || f.notes`
- Flow path: `f.path || f.steps || f.hops || f.route`

### API Key Storage
- Default: `sessionStorage` (cleared on tab close)
- `persist: true` on a `ModelProfile` → `localStorage` (requires explicit user opt-in with security notice)
- `loadProfiles()` merges both storages; `saveProfiles()` routes by `persist` flag

### AI Provider Routing
- Anthropic + Bedrock: `generateText()` → manual JSON parse + repair → Zod `safeParse`
- OpenAI / Gemini / Custom: `generateObject()` with Zod schema
- Reason: Anthropic's grammar-based tool enforcement rejects our HLDSchema (too large/complex)

### Theme
- `AV` is a module-level `let` reassigned at start of every `App` render: `AV = dark ? DARK : LIGHT`
- Consistent within a render pass; `function` declarations read `AV` at call time
- Gradient text spans need `display: inline-block` + `key={dark?"d":"l"}` to force DOM remount on theme switch

### PII Redaction
- `buildRedactionMap()` → forward map (real → token); stored in `redMapRef` (useRef)
- `INJECT_RE` strips prompt injection from TF content AND Additional Instructions field
- Registry defaults trimmed to 2KB before injecting into prompt (avoids timeouts)

### Diagrams
- **All diagrams use Mermaid** — never introduce a custom SVG renderer
- `buildMermaid()` uses `toArr()` for all doc arrays (non-Claude models may return objects)
- `initMermaid(dark)` must be called before `window.mermaid.render()` to apply the correct theme
- DCF and Edge tabs are conditionally shown based on whether data is present in the HLD

### DCF (Aviatrix Distributed Cloud Firewall) extraction
The prompt has explicit rules (see `DCF (Aviatrix Distributed Cloud Firewall)` section in `lib/systemPrompt.ts`) for extracting:
- `aviatrix_smart_group` → `dcf.smart_groups[]` with `members[]` summarised from `selector.match_expressions` (cidr / fqdn / site / s2c / type=vm|k8s|serverless / external+ext_args)
- `aviatrix_web_group` → `dcf.web_groups[]` with `domains[]` from `snifilter` and `urlfilter`
- `aviatrix_distributed_firewalling_policy_list` → `dcf.rulesets[]` with UUIDs resolved back to smart_group / web_group `name` attributes via the Terraform reference graph
- TLS decryption is flagged from `decrypt_policy` containing `DECRYPT` or `tls_profile` being set

The renderer in `App.tsx` for SmartGroup / WebGroup cards uses `toObjArr` / `toArr` / `toStr` and falls back across field-name variants (`members`/`cidrs`/`values`; `domains`/`snifilter`/`urlfilter`). If both `members`/`domains` and `description` are empty it shows an italic "No selector members extracted" hint rather than a blank card. The regression fixture at `test/fixtures/aviatrix-dcf-policies.tf` mirrors the canonical examples from the Aviatrix provider docs.

### Prompt Versioning

**Before changing `lib/systemPrompt.ts`:**
1. Archive it: `cp lib/systemPrompt.ts prompts/vN-label.ts` (latest archive is `prompts/v7-prose-fields.ts`; the live prompt in `lib/systemPrompt.ts` is the post-v7 / "v8 — DCF extraction" iteration)
2. Make changes to `lib/systemPrompt.ts`
3. Run `npm run test:prompts:compare` — side-by-side comparison of all versions
4. Only proceed if new version ties or improves on all assertions

**Template-literal gotcha:** the prompt body lives inside an `export const SYS = \`...\`` template literal. Any backticks used inside the prompt content close the literal early. Use apostrophes for inline code references (e.g. write `'aviatrix_smart_group.foo.uuid'`, not the backtick form).

**Test harness is currently broken.** `npm run test:prompts` / `:compare` both fail with a Nunjucks `Template render error: expected variable end` whenever a test substitutes a fixture via `{{file://test/fixtures/*.tf}}`. The fixtures themselves contain no Nunjucks tokens; the failure is in promptfoo's template pipeline (likely a regression in a recent `^0.121.x` patch). Tests that use inline TF content still execute correctly. Fixing the harness is its own work item — pin promptfoo, rewrite the runner as a small Node script that calls the Anthropic SDK directly, or use a JSON/YAML messages file with `{% raw %}` wrappers around the user content. Until then, validate prompt changes by running the app against the `test/fixtures/*.tf` files manually.

### Local Models (LM Studio / Ollama)

For local providers, all three actions (Generate HLD, Explain, Validate) call the model **directly from the browser** — Vercel is not involved. This works because both LM Studio and Ollama expose an OpenAI-compatible API on localhost.

**Browser compatibility:** tested and working on **Firefox** and **Safari**. Chrome/Chromium-based browsers (including Comet) block HTTPS→localhost requests via the Private Network Access policy and the flag to disable it has been removed in recent versions.

**LM Studio setup:**
- Enable the local server in LM Studio → Local Server tab
- Enable CORS in Server Settings
- Default endpoint: `http://localhost:1234/v1`

**Ollama setup:**
- Must be started with `OLLAMA_ORIGINS` set to allow the app's domain:
  ```bash
  OLLAMA_ORIGINS="https://your-app.vercel.app" ollama serve
  ```
- Use `~/ollama-start.sh` (created during setup) for on-demand start
- Disable Ollama auto-start: System Settings → General → Login Items → remove Ollama
- Default endpoint: `http://localhost:11434/v1`

**Thinking models:** temperature is passed as-is from the profile (`undefined` for thinking models, which omits the field from the request). Never default to `0` for local calls.

### Vercel Deployment
- Pro plan required for `maxDuration > 60s` — currently set to 300s in `vercel.json`
- Free (Hobby) tier: functions hard-capped at 10s regardless of `maxDuration` config
- `api/generate.ts` uses two-pass generation: Pass 1 (full HLD) + Pass 2 (lightweight delta critique, 2000 tokens max)

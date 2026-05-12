# Prompt Versions

This directory contains archived versions of the system prompt for regression
testing and A/B comparison via promptfoo.

The **current prompt** lives in `lib/systemPrompt.ts`. Archived versions are
snapshots taken *before* the next iteration was applied — i.e. each file
captures the prompt as it was just prior to the change named in its filename.

## Files

| File | What it contained / what was about to change |
|---|---|
| `v1-aviatrix.ts` | Original prompt — Aviatrix-focused, IDD terminology, tool-call output |
| `v2-universal.ts` | Snapshot before the prompt was broadened from Aviatrix-only to universal Terraform support |
| `v3-no-aviatrix-bias.ts` | Snapshot before adding explicit "no-Aviatrix-bias" guards for non-Aviatrix configs |
| `v4-component-rules.ts` | Snapshot before adding the `COMPONENTS — MANDATORY` extraction rules |
| `v5-schema-template.ts` | Snapshot before adding the schema-template guidance for required top-level fields |
| `v6-json-template.ts` | Snapshot using an inline JSON schema template (`{ "title": "string", ... }`) |
| `v7-prose-fields.ts` | Snapshot using the prose `REQUIRED TOP-LEVEL FIELDS:` list (replaced the JSON template) |
| `lib/systemPrompt.ts` (live) | **v8** — DCF SmartGroup / WebGroup / policy-list extraction added |

## Adding a new version

When making significant prompt changes:

1. Copy `lib/systemPrompt.ts` to `prompts/vN-<one-word-label>.ts` (e.g. `v9-foo.ts`)
2. Edit `lib/systemPrompt.ts` with your changes
3. Add the new file to the `prompts:` list in `promptfoo.yaml`
4. Run `npm run test:prompts:compare` — promptfoo scores all versions against all test cases
5. If the new version wins (or ties) on all assertions, commit

**Template-literal gotcha:** the prompt body lives inside `export const SYS = \`...\``. Backticks inside the prompt content close the template literal early. Use apostrophes for inline code references (e.g. `'aviatrix_smart_group.foo.uuid'`).

## Test harness status — currently broken

`npm run test:prompts` and `:compare` both fail with a Nunjucks
`Template render error: expected variable end` for every test that
substitutes a fixture via `{{file://test/fixtures/*.tf}}`. None of the
fixtures contain Nunjucks-special tokens (`{{`, `{%`, `{#`); the failure is
in promptfoo's template pipeline (`^0.121.x` has a regression). Tests with
inline TF content do execute and produce HLD JSON.

Two viable fixes for someone picking this up:

- Pin `promptfoo` to the version current when the harness was first wired up
  (commit `2d69d1a` — *Add prompt versioning with promptfoo*) and see if the
  templating works again.
- Replace the harness with a small Node script that loads each prompt file,
  reads each fixture, calls the Anthropic SDK directly, and runs the JS
  assertions inline. The fixtures and assertions are the valuable artefact;
  promptfoo's runner is replaceable.

Until then, validate prompt changes by running the dev server and uploading
fixtures from `test/fixtures/` manually.

## Running tests

```bash
export ANTHROPIC_API_KEY=sk-ant-...

# Test current prompt only (fast — when working)
npm run test:prompts

# Compare all versions side-by-side (slower — runs N prompts × M tests)
npm run test:prompts:compare

# Open results in browser UI
npm run test:prompts:view
```

## What the tests check

- **Firewall detection** — explicit image string and via tfvars variable resolution
- **Anti-hallucination** — no invented firewalls, no invented spoke VPCs
- **Provider detection** — AWS identified correctly
- **Schema completeness** — all required HLD fields present
- **Caveats** — populated when values are inferred from defaults
- **No vendor fabrication** — unresolvable vendor stays "unknown"
- **DCF extraction (v8+)** — `dcf.smart_groups[*].members` and `dcf.web_groups[*].domains` non-empty, UUIDs resolved to names, TLS decryption flagged for policies with `decrypt_policy` / `tls_profile`

## Scoring

promptfoo shows pass/fail per assertion per prompt version. A good prompt change:
- Passes all existing assertions (no regression)
- Ideally improves soft assertions (threshold < 1) to pass more consistently

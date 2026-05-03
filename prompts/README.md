# Prompt Versions

This directory contains archived versions of the system prompt for regression
testing and A/B comparison via promptfoo.

## Files

| File | Description |
|---|---|
| `v1-aviatrix.ts` | Original prompt — Aviatrix-focused, IDD terminology |

The **current prompt** lives in `lib/systemPrompt.ts` and is labeled `v2 (current)` in tests.

## Adding a new version

When making significant prompt changes:

1. Copy `lib/systemPrompt.ts` to `prompts/v2-current.ts` (archive the old current)
2. Edit `lib/systemPrompt.ts` with your changes
3. Run `npm run test:prompts:compare` — promptfoo scores both versions against all test cases
4. If the new version wins (or ties) on all assertions, commit

## Running tests

```bash
# Test current prompt only (fast)
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

## Scoring

promptfoo shows pass/fail per assertion per prompt version. A good prompt change:
- Passes all existing assertions (no regression)
- Ideally improves soft assertions (threshold < 1) to pass more consistently

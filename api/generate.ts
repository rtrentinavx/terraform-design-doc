import { generateObject, generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { initSentry, Sentry } from "./_sentry.js";
import { checkOrigin } from "./_origin.js";
import { HLDSchema } from "../lib/iddSchema.js";
import { SYS } from "../lib/systemPrompt.js";

const TEXT_PROVIDERS = new Set(["anthropic", "bedrock", "custom"]);

const CRITIQUE_PROMPT = `You are auditing a High Level Design (HLD) document for accuracy against Terraform source code.

Review the HLD JSON carefully against the Terraform code provided.
Fix ONLY verified errors — do not change anything that is correct:
- Remove or correct component names that do not exist as resource/module names in the Terraform
- Fix VPC/subnet CIDRs that don't match the code
- Remove invented resources, connections, or data flows not present in the code
- Correct firewall vendors, products, or configurations that contradict the code
- Remove spoke attachments, VPN connections, or peering not explicitly defined
- Add any obvious resources from the Terraform that were missed
- Update caveats[] to reflect any fields you corrected

Return ONLY the corrected HLD as valid JSON — same structure, no markdown, no explanation.
If the HLD is already accurate, return it unchanged.`;

function buildModel(provider: string, apiKey: string, model: string, baseUrl?: string) {
  if (provider === "anthropic") return createAnthropic({ apiKey })(model);
  if (provider === "bedrock") {
    const region = baseUrl || "us-east-1";
    return createAmazonBedrock({
      region,
      apiKey,
      baseURL: `https://bedrock-mantle.${region}.api.aws/v1`,
    })(model);
  }
  if (provider === "gemini") return createGoogleGenerativeAI({ apiKey })(model);
  if (provider === "azure") return createOpenAI({ apiKey, baseURL: `${baseUrl}/openai/deployments/${model}`, compatibility: "compatible" })(model, { structuredOutputs: true });
  return createOpenAI({ apiKey, baseURL: baseUrl, compatibility: "compatible" })(model);
}

function repairJson(raw: string): string {
  let s = raw.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, "").replace(/,\s*"[^"]*$/, "").replace(/"[^"]*$/, '"..."');
  const opens = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  const arrOpen = (s.match(/\[/g) || []).length - (s.match(/\]/g) || []).length;
  for (let i = 0; i < arrOpen; i++) s += "]";
  for (let i = 0; i < opens; i++) s += "}";
  return s;
}

async function parseHLD(text: string): Promise<any> {
  const raw = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(raw); }
  catch { return JSON.parse(repairJson(raw)); }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkOrigin(req, res)) return;

  const { provider = "anthropic", apiKey, model, baseUrl, content, maxTokens = 16000 } = req.body;
  if (!apiKey) return res.status(401).json({ error: "Missing apiKey" });
  if (!content) return res.status(400).json({ error: "Missing content" });

  const bodySize = JSON.stringify(req.body).length;
  if (bodySize > 5 * 1024 * 1024) return res.status(413).json({ error: "Request too large (max 5 MB)" });

  try {
    initSentry();
    const mdl = buildModel(provider, apiKey, model, baseUrl);

    let hld: any;
    let usage: any;

    if (TEXT_PROVIDERS.has(provider)) {
      // Pass 1 — generate HLD
      const pass1 = await generateText({
        model: mdl,
        system: SYS + "\n\nReturn ONLY valid JSON. No markdown fences, no explanation.",
        prompt: content,
        temperature: 0,
        maxTokens,
      });
      usage = pass1.usage;
      hld = await parseHLD(pass1.text);

      // Pass 2 — self-critique: compare HLD against original TF and fix hallucinations
      const pass2 = await generateText({
        model: mdl,
        system: CRITIQUE_PROMPT,
        prompt: `TERRAFORM CODE:\n${content}\n\nGENERATED HLD:\n${JSON.stringify(hld)}`,
        temperature: 0,
        maxTokens: Math.min(maxTokens, 12000),
      });
      // Accumulate token usage across both passes
      if (pass2.usage) {
        usage = {
          input_tokens: (usage?.input_tokens || 0) + (pass2.usage.input_tokens || 0),
          output_tokens: (usage?.output_tokens || 0) + (pass2.usage.output_tokens || 0),
          prompt_tokens: (usage?.prompt_tokens || 0) + (pass2.usage.prompt_tokens || 0),
          completion_tokens: (usage?.completion_tokens || 0) + (pass2.usage.completion_tokens || 0),
        };
      }
      try { hld = await parseHLD(pass2.text); } catch { /* keep pass1 hld if critique fails */ }
    } else {
      // OpenAI / Gemini / Custom: single pass with generateObject (schema enforced)
      const result = await generateObject({ model: mdl, schema: HLDSchema, system: SYS, prompt: content, temperature: 0, maxTokens });
      hld = result.object;
      usage = result.usage;
    }

    const validated = HLDSchema.safeParse(hld);
    const object = validated.success ? validated.data : hld;
    return res.status(200).json({ object, usage });
  } catch (err: any) {
    Sentry.captureException(err);
    const msg = err?.message || (typeof err?.error === "object" ? err.error?.message : err?.error) || String(err);
    const status = msg.includes("401") ? 401 : msg.includes("429") ? 429 : 500;
    res.status(status).json({ error: msg });
  }
}

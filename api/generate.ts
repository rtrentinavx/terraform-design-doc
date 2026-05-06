import { generateObject, generateText } from "ai";
import { z } from "zod";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { initSentry, Sentry } from "./_sentry.js";
import { checkOrigin } from "./_origin.js";
import { HLDSchema } from "../lib/iddSchema.js";
import { SYS } from "../lib/systemPrompt.js";

// Anthropic + Bedrock + Custom: generateText (JSON from prompt)
// OpenAI / Gemini / Azure: generateObject (Zod schema enforced)
const TEXT_PROVIDERS = new Set(["anthropic", "bedrock", "custom"]);

const CRITIQUE_PROMPT = `You are auditing a High Level Design (HLD) document for accuracy against Terraform source code.
Return ONLY a JSON corrections object with these fields:
- accurate: true if no corrections needed, false otherwise
- remove_component_names: component names that are invented or absent from the Terraform (omit if none)
- remove_data_flow_names: data flow names that are invented or incorrect (omit if none)
- vpc_cidr_corrections: [{name, cidr}] for VPCs with wrong CIDRs (omit if none)
- caveats_to_add: strings to append to caveats for any corrections or warnings (omit if none)
Return ONLY valid JSON. No markdown fences, no explanation.`;

const CorrectionSchema = z.object({
  accurate: z.boolean(),
  remove_component_names: z.array(z.string()).optional(),
  remove_data_flow_names: z.array(z.string()).optional(),
  vpc_cidr_corrections: z.array(z.object({ name: z.string(), cidr: z.string() })).optional(),
  caveats_to_add: z.array(z.string()).optional(),
});

function applyCorrections(hld: any, c: z.infer<typeof CorrectionSchema>): any {
  let h = { ...hld };
  if (c.remove_component_names?.length) {
    const rm = new Set(c.remove_component_names);
    h.components = (h.components || []).filter((x: any) => !rm.has(x.name));
  }
  if (c.remove_data_flow_names?.length) {
    const rm = new Set(c.remove_data_flow_names);
    h.data_flows = (h.data_flows || []).filter((x: any) => !rm.has(x.name));
  }
  if (c.vpc_cidr_corrections?.length) {
    const map = new Map(c.vpc_cidr_corrections.map(x => [x.name, x.cidr]));
    if (h.network_design?.vpcs) {
      h.network_design = {
        ...h.network_design,
        vpcs: h.network_design.vpcs.map((v: any) => map.has(v.name) ? { ...v, cidr: map.get(v.name) } : v),
      };
    }
  }
  if (c.caveats_to_add?.length) {
    h.caveats = [...(h.caveats || []), ...c.caveats_to_add];
  }
  return h;
}

// Direct chat completions fetch — bypasses Vercel AI SDK endpoint selection.
// Prevents SDK from calling /v1/responses instead of /v1/chat/completions
// on providers that only support the classic Chat Completions API (e.g. Kimi).
async function chatCompletion(
  baseUrl: string, apiKey: string, model: string,
  messages: any[], maxTokens: number, temperature?: number
): Promise<{ text: string; usage: any }> {
  const url = baseUrl.replace(/\/$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, ...(temperature !== undefined && temperature !== null ? { temperature } : {}) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);
  if (data.choices?.[0]?.finish_reason === "length") {
    throw new Error("Response truncated: model hit token limit (finish_reason=length). Reduce input size or increase maxTokens.");
  }
  return { text: data.choices?.[0]?.message?.content || "", usage: data.usage || {} };
}

function buildModel(provider: string, apiKey: string, model: string, baseUrl?: string) {
  if (provider === "anthropic") return createAnthropic({ apiKey })(model);
  if (provider === "bedrock") return createOpenAI({
    apiKey,
    baseURL: `https://bedrock-mantle.${baseUrl || "us-east-1"}.api.aws/v1`,
    compatibility: "compatible",
  })(model);
  if (provider === "gemini") return createGoogleGenerativeAI({ apiKey })(model);
  if (provider === "azure") return createOpenAI({
    apiKey, baseURL: `${baseUrl}/openai/deployments/${model}`, compatibility: "compatible",
  })(model, { structuredOutputs: true });
  return createOpenAI({ apiKey, baseURL: baseUrl, compatibility: "compatible" })(model, { simulateStreaming: false });
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

function mergeUsage(a: any, b: any) {
  return {
    input_tokens:     (a?.input_tokens     || 0) + (b?.input_tokens     || b?.prompt_tokens     || 0),
    output_tokens:    (a?.output_tokens    || 0) + (b?.output_tokens    || b?.completion_tokens || 0),
    prompt_tokens:    (a?.prompt_tokens    || 0) + (b?.prompt_tokens    || 0),
    completion_tokens:(a?.completion_tokens|| 0) + (b?.completion_tokens|| 0),
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkOrigin(req, res)) return;

  const { provider = "anthropic", apiKey, model, baseUrl, content, temperature, maxTokens = 16000 } = req.body;
  if (!apiKey) return res.status(401).json({ error: "Missing apiKey" });
  if (!content) return res.status(400).json({ error: "Missing content" });

  const bodySize = JSON.stringify(req.body).length;
  if (bodySize > 5 * 1024 * 1024) return res.status(413).json({ error: "Request too large (max 5 MB)" });

  try {
    initSentry();

    let hld: any;
    let usage: any = {};

    if (TEXT_PROVIDERS.has(provider)) {
      const sysWithInstruction = SYS + "\n\nReturn ONLY valid JSON. No markdown fences, no explanation.";

      // Determine base URL for direct-fetch providers (custom + bedrock via Mantle)
      const directFetch = provider === "custom" || provider === "bedrock";
      const directBase = provider === "bedrock"
        ? `https://bedrock-mantle.${baseUrl || "us-east-1"}.api.aws/v1`
        : (baseUrl || "");

      // Pass 1: generate HLD
      if (directFetch) {
        const r1 = await chatCompletion(directBase, apiKey, model, [
          { role: "system", content: sysWithInstruction },
          { role: "user", content },
        ], maxTokens, temperature);
        hld = await parseHLD(r1.text);
        usage = r1.usage;
      } else {
        const mdl = buildModel(provider, apiKey, model, baseUrl);
        const p1 = await generateText({ model: mdl, system: sysWithInstruction, prompt: content, temperature: temperature ?? 0, maxTokens });
        hld = await parseHLD(p1.text);
        usage = p1.usage;
      }

      // Pass 2: lightweight delta critique — returns only corrections, not full HLD
      const critiqueMsg = `TERRAFORM CODE:\n${content}\n\nGENERATED HLD:\n${JSON.stringify(hld)}`;
      try {
        let corrRaw: string;
        if (directFetch) {
          const r2 = await chatCompletion(directBase, apiKey, model, [
            { role: "system", content: CRITIQUE_PROMPT },
            { role: "user", content: critiqueMsg },
          ], 2000, temperature);
          usage = mergeUsage(usage, r2.usage);
          corrRaw = r2.text;
        } else {
          const mdl = buildModel(provider, apiKey, model, baseUrl);
          const p2 = await generateText({ model: mdl, system: CRITIQUE_PROMPT, prompt: critiqueMsg, temperature: 0, maxTokens: 2000 });
          usage = mergeUsage(usage, p2.usage);
          corrRaw = p2.text;
        }
        const corrections = JSON.parse(corrRaw.replace(/```json|```/g, "").trim());
        const parsed = CorrectionSchema.safeParse(corrections);
        if (parsed.success && parsed.data.accurate === false) hld = applyCorrections(hld, parsed.data);
      } catch { /* keep pass1 hld if critique fails */ }

    } else {
      // OpenAI / Gemini / Azure: generateObject with Zod schema
      const mdl = buildModel(provider, apiKey, model, baseUrl);
      const result = await generateObject({ model: mdl, schema: HLDSchema, system: SYS, prompt: content, temperature: temperature ?? 0, maxTokens });
      hld = result.object;
      usage = result.usage;
    }

    const validated = HLDSchema.safeParse(hld);
    const object = validated.success ? validated.data : hld;
    return res.status(200).json({ object, usage });

  } catch (err: any) {
    Sentry.captureException(err);
    await Sentry.flush(2000);
    const msg = err?.message || (typeof err?.error === "object" ? err.error?.message : err?.error) || String(err);
    const status = msg.includes("401") ? 401 : msg.includes("429") ? 429 : 500;
    res.status(status).json({ error: msg });
  }
}

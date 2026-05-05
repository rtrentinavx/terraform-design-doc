import { generateObject, generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { initSentry, Sentry } from "./_sentry.js";
import { checkOrigin } from "./_origin.js";
import { z } from "zod";

const FindingSchema = z.object({
  severity: z.enum(["error", "warning", "info"]),
  category: z.enum(["security", "best-practice", "cost", "reliability", "aviatrix", "syntax"]),
  title: z.string(),
  description: z.string(),
  resource: z.string(),
  recommendation: z.string(),
});

const ValidationSchema = z.object({
  summary: z.string(),
  score: z.number().min(0).max(100),
  findings: z.array(FindingSchema),
});

const TEXT_PROVIDERS = new Set(["anthropic", "bedrock", "custom"]);

const VALIDATE_PROMPT = `You are a Terraform/OpenTofu security and best-practices auditor. Analyze the provided Terraform code and return a structured validation report as JSON.

Return ONLY valid JSON in this exact format — no markdown, no explanation:
{
  "summary": "2-3 sentence overall assessment",
  "score": <integer 0-100>,
  "findings": [
    {
      "severity": "error|warning|info",
      "category": "security|best-practice|cost|reliability|aviatrix|syntax",
      "title": "short title",
      "description": "what the issue is",
      "resource": "resource name or module block",
      "recommendation": "how to fix it"
    }
  ]
}

Evaluate for:
- SECURITY: open ingress rules, public storage, unencrypted resources, overly permissive IAM, exposed secrets
- BEST PRACTICES: missing tags, no remote state, missing variable descriptions, hardcoded values, missing required_providers version constraints
- AVIATRIX-SPECIFIC: missing HA on transit/spoke gateways, incorrect firenet configuration, missing BGP configuration, gateway sizing concerns
- RELIABILITY: single-AZ deployments without HA, missing backup configuration
- COST: oversized instance types, unused resources, expensive configurations with cheaper alternatives
- SYNTAX: undefined variables referenced, duplicate resource names, missing required arguments

Score: 100=no issues, 80-99=minor suggestions, 60-79=warnings, 40-59=significant issues, below 40=critical errors
Be specific: reference the actual resource name or module block.`;


async function chatCompletion(baseUrl: string, apiKey: string, model: string, messages: any[], maxTokens: number): Promise<{text: string}> {
  const url = baseUrl.replace(/\/$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, ...(temperature !== undefined && temperature !== null ? { temperature } : {}) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);
  return { text: data.choices?.[0]?.message?.content || "", usage: data.usage || {} };
}

function buildModel(provider: string, apiKey: string, model: string, baseUrl?: string) {
  if (provider === "anthropic") return createAnthropic({ apiKey })(model);
  if (provider === "bedrock") return createAmazonBedrock({ region: baseUrl||"us-east-1", apiKey })(model);
  if (provider === "gemini") return createGoogleGenerativeAI({ apiKey })(model);
  if (provider === "azure") return createOpenAI({ apiKey, baseURL: `${baseUrl}/openai/deployments/${model}`, compatibility: "compatible" })(model);
  return createOpenAI({ apiKey, baseURL: baseUrl, compatibility: "compatible" })(model, { simulateStreaming: false });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkOrigin(req, res)) return;

  const { provider = "anthropic", apiKey, model, baseUrl, content, temperature } = req.body;
  if (!apiKey) return res.status(401).json({ error: "Missing apiKey" });
  if (!content) return res.status(400).json({ error: "Missing content" });

  const bodySize = JSON.stringify(req.body).length;
  if (bodySize > 5 * 1024 * 1024) return res.status(413).json({ error: "Request too large (max 5 MB)" });

  try {
    const mdl = buildModel(provider, apiKey, model, baseUrl);

    if (TEXT_PROVIDERS.has(provider)) {
      let text: string;
      let usage: any = {};
      if (provider === "custom" || provider === "bedrock") {
        const bedrockBase = provider === "bedrock" ? `https://bedrock-mantle.${baseUrl||"us-east-1"}.api.aws/v1` : (baseUrl || "");
        const r = await chatCompletion(bedrockBase, apiKey, model, [
          { role: "system", content: VALIDATE_PROMPT },
          { role: "user", content },
        ], 4000, temperature);
        text = r.text;
        usage = r.usage;
      } else {
        const result = await generateText({ model: mdl, system: VALIDATE_PROMPT, prompt: content, temperature: temperature ?? 0, maxTokens: 4000 });
        text = result.text;
        usage = result.usage;
      }
      const raw = text.replace(/```json|```/g, "").trim();
      let parsed: any;
      try { parsed = JSON.parse(raw); }
      catch { parsed = { summary: "Parse error — raw response returned", score: 0, findings: [] }; }
      const result = ValidationSchema.safeParse(parsed);
      return res.status(200).json({ validation: result.success ? result.data : parsed, usage });
    } else {
      const { object, usage } = await generateObject({
        model: mdl,
        schema: ValidationSchema,
        system: VALIDATE_PROMPT,
        prompt: content,
        temperature: temperature ?? 0,
        maxTokens: 4000,
      });
      return res.status(200).json({ validation: object, usage });
    }
  } catch (err: any) {
    Sentry.captureException(err);
    const msg = err?.message || (typeof err?.error === "object" ? err.error?.message : err?.error) || String(err);
    const status = msg.includes("401") ? 401 : msg.includes("429") ? 429 : 500;
    res.status(status).json({ error: msg });
  }
}

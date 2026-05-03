import { generateObject, generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { checkOrigin } from "./_origin.js";
import { IDDSchema } from "../lib/iddSchema.js";
import { SYS } from "../lib/systemPrompt.js";

// Anthropic and Bedrock: use generateText (JSON from prompt) to avoid
// "compiled grammar too large" error from Anthropic's tool-use enforcement.
const TEXT_PROVIDERS = new Set(["anthropic", "bedrock"]);

function buildModel(provider: string, apiKey: string, model: string, baseUrl?: string, secretKey?: string) {
  if (provider === "anthropic") return createAnthropic({ apiKey })(model);
  if (provider === "bedrock") return createAmazonBedrock({
    region: baseUrl || "us-east-1", accessKeyId: apiKey, secretAccessKey: secretKey || "",
  })(model);
  if (provider === "gemini") return createGoogleGenerativeAI({ apiKey })(model);
  if (provider === "azure") return createOpenAI({
    apiKey, baseURL: `${baseUrl}/openai/deployments/${model}`, compatibility: "compatible",
  })(model, { structuredOutputs: true });
  return createOpenAI({ apiKey, baseURL: baseUrl, compatibility: "compatible" })(model, { structuredOutputs: true });
}

// Repair truncated JSON by closing unclosed brackets/braces
function repairJson(raw: string): string {
  let s = raw.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, "").replace(/,\s*"[^"]*$/, "").replace(/"[^"]*$/, '"..."');
  const opens = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  const arrOpen = (s.match(/\[/g) || []).length - (s.match(/\]/g) || []).length;
  for (let i = 0; i < arrOpen; i++) s += "]";
  for (let i = 0; i < opens; i++) s += "}";
  return s;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkOrigin(req, res)) return;

  const { provider = "anthropic", apiKey, secretKey, model, baseUrl, content, maxTokens = 16000 } = req.body;
  if (!apiKey) return res.status(401).json({ error: "Missing apiKey" });
  if (!content) return res.status(400).json({ error: "Missing content" });

  const bodySize = JSON.stringify(req.body).length;
  if (bodySize > 5 * 1024 * 1024) return res.status(413).json({ error: "Request too large (max 5 MB)" });

  try {
    const mdl = buildModel(provider, apiKey, model, baseUrl, secretKey);

    if (TEXT_PROVIDERS.has(provider)) {
      // Anthropic / Bedrock: prompt for JSON, parse + validate manually
      const { text } = await generateText({
        model: mdl,
        system: SYS + "\n\nReturn ONLY valid JSON matching the schema. No markdown fences, no explanation.",
        prompt: content,
        temperature: 0,
        maxTokens,
      });

      const raw = text.replace(/```json|```/g, "").trim();
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = JSON.parse(repairJson(raw));
      }

      // Validate with Zod (safe parse — don't crash on extra/missing fields)
      const result = IDDSchema.safeParse(parsed);
      const object = result.success ? result.data : parsed;

      return res.status(200).json({ object });
    } else {
      // OpenAI / Gemini / Custom: use generateObject with Zod schema
      const { object, usage } = await generateObject({
        model: mdl,
        schema: IDDSchema,
        system: SYS,
        prompt: content,
        temperature: 0,
        maxTokens,
      });
      return res.status(200).json({ object, usage });
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    const status = msg.includes("401") ? 401 : msg.includes("429") ? 429 : 500;
    res.status(status).json({ error: msg });
  }
}

import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { checkOrigin } from "./_origin.js";
import { IDDSchema } from "../lib/iddSchema.js";
import { SYS } from "../lib/systemPrompt.js";

function buildModel(provider: string, apiKey: string, model: string, baseUrl?: string) {
  if (provider === "anthropic") {
    return createAnthropic({ apiKey })(model);
  }
  if (provider === "gemini") {
    return createGoogleGenerativeAI({ apiKey })(model);
  }
  if (provider === "azure") {
    // Azure OpenAI: baseUrl = https://{resource}.openai.azure.com
    return createOpenAI({
      apiKey,
      baseURL: `${baseUrl}/openai/deployments/${model}`,
      compatibility: "compatible",
    })(model, { structuredOutputs: true });
  }
  // Custom OpenAI-compatible
  return createOpenAI({ apiKey, baseURL: baseUrl, compatibility: "compatible" })(model, { structuredOutputs: true });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkOrigin(req, res)) return;

  const { provider = "anthropic", apiKey, model, baseUrl, content, maxTokens = 16000 } = req.body;
  if (!apiKey) return res.status(401).json({ error: "Missing apiKey" });
  if (!content) return res.status(400).json({ error: "Missing content" });

  try {
    const mdl = buildModel(provider, apiKey, model, baseUrl);

    const { object, usage } = await generateObject({
      model: mdl,
      schema: IDDSchema,
      system: SYS,
      prompt: content,
      temperature: 0,
      maxTokens,
    });

    res.status(200).json({ object, usage });
  } catch (err: any) {
    // Surface AI SDK errors clearly
    const msg = err?.message || String(err);
    const status = msg.includes("401") ? 401 : msg.includes("429") ? 429 : 500;
    res.status(status).json({ error: msg });
  }
}

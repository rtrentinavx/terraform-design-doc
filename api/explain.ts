import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { checkOrigin } from "./_origin.js";

const EXPLAIN_PROMPT = [
  "You are a cloud infrastructure expert. Analyze the provided Terraform/OpenTofu code and explain it clearly for a technical audience.",
  "",
  "Structure your response in markdown with these sections:",
  "",
  "## Summary",
  "2-3 sentences on what this code deploys and its purpose.",
  "",
  "## Resources Created",
  "Bulleted list of the key infrastructure resources and services being provisioned.",
  "",
  "## Architecture",
  "How the components connect and interact. Include topology, traffic flow, and any hub-spoke or multi-cloud patterns.",
  "",
  "After the architecture description, include a Mermaid diagram using flowchart LR layout showing key resources and connections. Wrap it in a mermaid code fence.",
  "",
  "## Security",
  "Key security configurations: firewall rules, encryption, access controls, network segmentation.",
  "",
  "## Variables & Customization",
  "Important input variables, what they control, and notable defaults.",
  "",
  "## Dependencies & Prerequisites",
  "What this code depends on, required permissions, and deployment order.",
  "",
  "## Potential Issues",
  "Any misconfigurations, missing best practices, or things to verify before applying.",
  "",
  "Be concise and technical. Use markdown formatting throughout.",
].join("\n");

function buildModel(provider: string, apiKey: string, model: string, baseUrl?: string) {
  if (provider === "anthropic") return createAnthropic({ apiKey })(model);
  if (provider === "bedrock") return createAmazonBedrock({ region: baseUrl || "us-east-1", apiKey })(model);
  if (provider === "gemini") return createGoogleGenerativeAI({ apiKey })(model);
  if (provider === "azure") return createOpenAI({ apiKey, baseURL: `${baseUrl}/openai/deployments/${model}`, compatibility: "compatible" })(model);
  return createOpenAI({ apiKey, baseURL: baseUrl, compatibility: "compatible" })(model);
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return res.status(405).end();
    if (!checkOrigin(req, res)) return;

    const { provider = "anthropic", apiKey, model, baseUrl, content } = req.body || {};
    if (!apiKey) return res.status(401).json({ error: "Missing apiKey" });
    if (!content) return res.status(400).json({ error: "Missing content" });

    const bodySize = JSON.stringify(req.body).length;
    if (bodySize > 5 * 1024 * 1024) return res.status(413).json({ error: "Request too large (max 5 MB)" });

    const mdl = buildModel(provider, apiKey, model, baseUrl);
    const { text } = await generateText({
      model: mdl,
      system: EXPLAIN_PROMPT,
      prompt: content,
      temperature: 0,
      maxTokens: 4000,
    });

    const lower = text.toLowerCase();
    const offTopic = !lower.includes("terraform") && !lower.includes("resource") &&
      !lower.includes("infrastructure") && !lower.includes("cloud") &&
      !lower.includes("module") && !lower.includes("provider") && text.length > 200;
    if (offTopic) return res.status(422).json({ error: "Unexpected response — ensure uploaded files contain Terraform code." });

    res.status(200).json({ explanation: text });
  } catch (err: any) {
    const msg = err?.message || err?.toString?.() || "Unknown error";
    const status = msg.includes("401") ? 401 : msg.includes("429") ? 429 : 500;
    try {
      res.status(status).json({ error: msg });
    } catch {
      res.status(500).end();
    }
  }
}

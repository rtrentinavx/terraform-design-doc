import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
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

const VALIDATE_PROMPT = `You are a Terraform/OpenTofu security and best-practices auditor. Analyze the provided Terraform code and return a structured validation report.

Evaluate for:
- SECURITY: open ingress rules, public storage, unencrypted resources, overly permissive IAM, exposed secrets
- BEST PRACTICES: missing tags, no remote state, missing variable descriptions, hardcoded values that should be variables, missing required_providers version constraints
- AVIATRIX-SPECIFIC: missing HA on transit/spoke gateways, incorrect firenet configuration, missing BGP configuration, gateway sizing concerns
- RELIABILITY: single-AZ deployments without HA, missing backup configuration
- COST: oversized instance types, unused resources, expensive configurations with cheaper alternatives
- SYNTAX: undefined variables referenced, duplicate resource names, missing required arguments

Score from 0-100 where:
100 = no issues
80-99 = minor suggestions only
60-79 = warnings present
40-59 = significant issues
below 40 = critical errors

Be specific: reference the actual resource name or module block from the code.`;

function buildModel(provider: string, apiKey: string, model: string, baseUrl?: string, secretKey?: string) {
  if (provider === "anthropic") return createAnthropic({ apiKey })(model);
  if (provider === "bedrock") return createAmazonBedrock({ region: baseUrl||"us-east-1", accessKeyId: apiKey, secretAccessKey: secretKey||"" })(model);
  if (provider === "gemini") return createGoogleGenerativeAI({ apiKey })(model);
  if (provider === "azure") return createOpenAI({ apiKey, baseURL: `${baseUrl}/openai/deployments/${model}`, compatibility: "compatible" })(model);
  return createOpenAI({ apiKey, baseURL: baseUrl, compatibility: "compatible" })(model);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkOrigin(req, res)) return;

  const { provider = "anthropic", apiKey, secretKey, model, baseUrl, content } = req.body;
  if (!apiKey) return res.status(401).json({ error: "Missing apiKey" });
  if (!content) return res.status(400).json({ error: "Missing content" });

  // Body size limit
  const bodySize = JSON.stringify(req.body).length;
  if (bodySize > 5 * 1024 * 1024) return res.status(413).json({ error: "Request too large (max 5 MB)" });

  try {
    const mdl = buildModel(provider, apiKey, model, baseUrl, secretKey);
    const { object } = await generateObject({
      model: mdl,
      schema: ValidationSchema,
      system: VALIDATE_PROMPT,
      prompt: content,
      temperature: 0,
      maxTokens: 4000,
    });
    res.status(200).json(object);
  } catch (err: any) {
    const msg = err?.message || String(err);
    const status = msg.includes("401") ? 401 : msg.includes("429") ? 429 : 500;
    res.status(status).json({ error: msg });
  }
}

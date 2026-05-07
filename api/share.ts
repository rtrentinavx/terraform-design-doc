import { cacheGet, cacheSet } from "./_cache.js";
import { checkOrigin } from "./_origin.js";

const SHARE_TTL = 60 * 60 * 24 * 30; // 30 days
const MAX_BYTES = 512 * 1024;         // 512 KB

export default async function handler(req: any, res: any) {
  if (!checkOrigin(req, res)) return;

  if (req.method === "POST") {
    const { hld } = req.body || {};
    if (!hld) return res.status(400).json({ error: "Missing hld" });
    const json = JSON.stringify(hld);
    if (json.length > MAX_BYTES) return res.status(413).json({ error: "Document too large to share (max 512 KB)" });
    const id = crypto.randomUUID();
    const key = `share:${id}`;
    await cacheSet(key, json, SHARE_TTL);
    const verify = await cacheGet(key);
    if (!verify) return res.status(503).json({ error: "Redis not configured — set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel environment variables." });
    return res.status(200).json({ id, expiresIn: "30 days" });
  }

  if (req.method === "GET") {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: "Missing id" });
    const raw = await cacheGet(`share:${id}`);
    if (!raw) return res.status(404).json({ error: "Document not found or expired" });
    const hld = typeof raw === "string" ? JSON.parse(raw) : raw;
    return res.status(200).json({ hld });
  }

  return res.status(405).end();
}

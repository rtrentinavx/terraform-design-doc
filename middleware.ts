import { protect } from "@vercel/firewall";
import type { NextRequest } from "next/server";

// BotID middleware — runs at the edge before requests reach API functions.
// Vercel's Kasada-powered analysis blocks bots invisibly without user friction.
// Enable BotID in: Vercel dashboard → Project → Firewall → BotID
export default async function middleware(req: NextRequest) {
  return protect(req);
}

export const config = {
  matcher: [
    "/api/generate",
    "/api/explain",
    "/api/validate",
    "/api/dcf",
    "/api/list-models",
    "/api/registry-defaults",
  ],
};

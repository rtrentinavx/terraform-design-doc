// Shared origin check for all API routes.
// Allows requests from the production domain, Vercel preview deployments,
// and localhost dev. Rejects anything else with 403.
const ALLOWED = [
  /^https:\/\/terraform-design-doc[\w-]*\.vercel\.app$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

export function checkOrigin(req, res) {
  const origin = req.headers.origin || req.headers.referer || "";
  const allowed = !origin || ALLOWED.some(re => re.test(origin));
  if (!allowed) {
    res.status(403).json({ error: { message: "Forbidden" } });
    return false;
  }
  return true;
}

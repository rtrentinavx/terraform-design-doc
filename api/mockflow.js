export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const headers = { "Content-Type": "application/json" };
    // Forward session header if present
    if (req.headers["mcp-session-id"]) {
      headers["mcp-session-id"] = req.headers["mcp-session-id"];
    }

    const response = await fetch("https://app.mockflow.com/ideaboard/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify(req.body),
    });

    // Forward session header back to client
    const sessionId = response.headers.get("mcp-session-id");
    if (sessionId) {
      res.setHeader("mcp-session-id", sessionId);
    }

    const data = await response.text();
    res.status(response.status).setHeader("Content-Type", "application/json").send(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

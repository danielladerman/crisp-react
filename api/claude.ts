import type { VercelRequest, VercelResponse } from "@vercel/node";
import { jwtVerify } from "jose";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_JWT_SECRET } = process.env;
  if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_JWT_SECRET) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  // Verify Supabase JWT
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET);
    await jwtVerify(token, secret, { issuer: `${SUPABASE_URL}/auth/v1` });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Forward request to Anthropic API
  const body = req.body;
  const isStreaming = body?.stream === true;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!anthropicRes.ok) {
      const errorBody = await anthropicRes.text();
      return res.status(anthropicRes.status).send(errorBody);
    }

    if (isStreaming) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const reader = anthropicRes.body?.getReader();
      if (!reader) {
        return res.status(502).json({ error: "No response body from Anthropic" });
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        reader.releaseLock();
        res.end();
      }
    } else {
      const data = await anthropicRes.json();
      return res.status(200).json(data);
    }
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach Anthropic API" });
  }
}

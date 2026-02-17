import jwt from "jsonwebtoken";
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ error: "Method not allowed — use POST instead" });
  }

  const apiKey = process.env.API_SECRET_KEY;
  const providedKey = req.headers["x-api-key"];

  if (!apiKey || providedKey !== apiKey) {
    return res.status(401).json({ error: "Unauthorized — wrong API key" });
  }

  const { deviceToken, title, bodyText } = req.body ?? {};

  if (!deviceToken || !title || !bodyText) {
    return res
      .status(400)
      .json({ error: "Missing deviceToken, title or bodyText" });
  }

  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const bundleId = process.env.APP_BUNDLE_ID;
  const privateKey = process.env.APPLE_AUTH_KEY?.replace(/\\n/g, "\n");

  if (!teamId || !keyId || !bundleId || !privateKey) {
    return res.status(500).json({ error: "Missing APNS secrets" });
  }

  const token = jwt.sign(
    { iss: teamId, iat: Math.floor(Date.now() / 1000) },
    privateKey,
    { algorithm: "ES256", header: { alg: "ES256", kid: keyId } }
  );

  try {
    const apnsResponse = await fetch(
      `https://api.push.apple.com/3/device/${deviceToken}`,
      {
        method: "POST",
        headers: {
          authorization: `bearer ${token}`,
          "apns-topic": bundleId,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          aps: {
            alert: { title, body: bodyText },
            sound: "default",
          },
        }),
      }
    );

    return res.status(apnsResponse.status).json({
      status: apnsResponse.status,
      ok: apnsResponse.ok,
    });
  } catch (error) {
    console.error("APNS Error:", error);
    return res.status(500).json({ error: "APNS request failed" });
  }
}

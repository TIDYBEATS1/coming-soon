// pages/api/sendNotification.ts
import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- SECRET CHECK ---
  // Expect the app to send a header "x-api-key" with your secret
  const incomingSecret = req.headers["x-api-key"];
  if (incomingSecret !== process.env.API_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Destructure payload
  const { deviceToken, title, bodyText } = req.body;

  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const bundleId = process.env.APP_BUNDLE_ID;
  const privateKey = process.env.APPLE_AUTH_KEY?.replace(/\\n/g, "\n");

  if (!teamId || !keyId || !bundleId || !privateKey) {
    return res.status(500).json({ error: "Missing secrets" });
  }

  try {
    // Create JWT for APNS
    const token = jwt.sign(
      {
        iss: teamId,
        iat: Math.floor(Date.now() / 1000),
      },
      privateKey,
      { algorithm: "ES256", header: { alg: "ES256", kid: keyId } }
    );

    // Send request to APNS
    const apnsResponse = await fetch(
      `https://api.sandbox.push.apple.com/3/device/${deviceToken}`,
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

    return res.status(200).json({ status: apnsResponse.status });
  } catch (error) {
    console.error("APNS Error:", error);
    return res.status(500).json({ error: "Failed to send notification" });
  }
}

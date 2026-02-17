// pages/api/sendNotification.ts
import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    // APNS request
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
            alert: {
              title: title,
              body: bodyText,
            },
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

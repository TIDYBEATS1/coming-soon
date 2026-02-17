// /api/sendNotification.js
import apn from "apn";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed — use POST instead" });
  }

  // ✅ API Key check
  const apiKey = process.env.API_SECRET_KEY;
  const providedKey = req.headers["x-api-key"];
  if (!apiKey || providedKey !== apiKey) {
    return res.status(401).json({ error: "Unauthorized — wrong API key" });
  }

  const { deviceToken, title, bodyText, useSandbox } = req.body ?? {};

  if (!deviceToken || !title || !bodyText) {
    return res.status(400).json({ error: "Missing deviceToken, title, or bodyText" });
  }

  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const bundleId = process.env.APP_BUNDLE_ID;
  const privateKey = process.env.APPLE_AUTH_KEY?.replace(/\\n/g, "\n");

  if (!teamId || !keyId || !bundleId || !privateKey) {
    return res.status(500).json({ error: "Missing APNS secrets" });
  }

  try {
    // ✅ Configure APN provider
    const apnProvider = new apn.Provider({
      token: {
        key: Buffer.from(privateKey), // or path to .p8 file if you prefer
        keyId: keyId,
        teamId: teamId,
      },
      production: !useSandbox, // true for production, false for sandbox
    });

    // ✅ Create notification
    const notification = new apn.Notification({
      alert: { title, body: bodyText },
      sound: "default",
      topic: bundleId,
    });

    // ✅ Send notification
    const result = await apnProvider.send(notification, deviceToken);

    // Log full response
    console.log("APNS Result:", result);

    // Always shutdown provider
    apnProvider.shutdown();

    // Check for failures
    if (result.failed && result.failed.length > 0) {
      return res.status(500).json({ error: "APNS request failed", details: result.failed });
    }

    return res.status(200).json({ status: "success", result });
  } catch (error) {
    console.error("APNS Error:", error);
    return res.status(500).json({ error: "APNS request threw an error", details: error.message });
  }
}

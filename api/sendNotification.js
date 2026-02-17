// /api/sendNotification.js
import apn from "apn";
import { NextResponse } from "next/server";

export async function POST(req) {
  const body = await req.json();

  // ✅ API Key check
  const apiKey = process.env.API_SECRET_KEY;
  const providedKey = req.headers.get("x-api-key");
  if (!apiKey || providedKey !== apiKey) {
    return NextResponse.json({ error: "Unauthorized — wrong API key" }, { status: 401 });
  }

  const { deviceToken, title, bodyText, useSandbox } = body ?? {};

  if (!deviceToken || !title || !bodyText) {
    return NextResponse.json({ error: "Missing deviceToken, title, or bodyText" }, { status: 400 });
  }

  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const bundleId = process.env.APP_BUNDLE_ID;
  const privateKey = process.env.APPLE_AUTH_KEY?.replace(/\\n/g, "\n");

  if (!teamId || !keyId || !bundleId || !privateKey) {
    return NextResponse.json({ error: "Missing APNS secrets" }, { status: 500 });
  }

  try {
    // ✅ Configure APN provider
    const apnProvider = new apn.Provider({
      token: { key: privateKey, keyId, teamId },
      production: !useSandbox,
    });

    // ✅ Create notification
    const notification = new apn.Notification({
      alert: { title, body: bodyText },
      sound: "default",
      topic: bundleId,
      pushType: "alert", // needed for iOS 13+
    });

    // ✅ Send notification
    const result = await apnProvider.send(notification, deviceToken);
    apnProvider.shutdown();

    console.log("APNS Result:", result);

    if (result.failed && result.failed.length > 0) {
      return NextResponse.json({ error: "APNS request failed", details: result.failed }, { status: 500 });
    }

    return NextResponse.json({ status: "success", result });
  } catch (error) {
    console.error("APNS Error:", error);
    return NextResponse.json({ error: "APNS request threw an error", details: error.message }, { status: 500 });
  }
}

import apn from "apn";

export async function POST(req) {
  const body = await req.json();

  // ✅ API Key check
  const apiKey = process.env.API_SECRET_KEY;
  const providedKey = req.headers.get("x-api-key");
  if (!apiKey || providedKey !== apiKey) {
    return new Response(
      JSON.stringify({ error: "Unauthorized — wrong API key" }),
      { status: 401 }
    );
  }

  const { deviceToken, title, bodyText } = body ?? {};

  if (!deviceToken || !title || !bodyText) {
    return new Response(
      JSON.stringify({ error: "Missing deviceToken, title, or bodyText" }),
      { status: 400 }
    );
  }

  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const bundleId = process.env.APP_BUNDLE_ID;
  const privateKey = process.env.APPLE_AUTH_KEY?.replace(/\\n/g, "\n");

  if (!teamId || !keyId || !bundleId || !privateKey) {
    return new Response(
      JSON.stringify({ error: "Missing APNS secrets" }),
      { status: 500 }
    );
  }

  try {
    // ✅ Detect environment automatically
    const isProduction = process.env.VERCEL_ENV === "production";

    // ✅ Configure APN provider
    const apnProvider = new apn.Provider({
      token: { key: privateKey, keyId, teamId },
      production: isProduction,
    });

    // ✅ Create notification
    const notification = new apn.Notification({
      alert: { title, body: bodyText },
      sound: "default",
      topic: bundleId,
      pushType: "alert", // required for iOS 13+
    });

    // ✅ Send notification
    const result = await apnProvider.send(notification, deviceToken);
    apnProvider.shutdown();

    console.log("APNS Result:", result);

    if (result.failed && result.failed.length > 0) {
      return new Response(
        JSON.stringify({ error: "APNS request failed", details: result.failed }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify({ status: "success", result }), { status: 200 });
  } catch (error) {
    console.error("APNS Error:", error);
    return new Response(
      JSON.stringify({ error: "APNS request threw an error", details: error.message }),
      { status: 500 }
    );
  }
}

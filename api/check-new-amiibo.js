import fetch from "node-fetch";
import crypto from "crypto";
import admin from "firebase-admin";

let lastHash = "";

// Initialize Firebase once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  try {
    // 1️⃣ Fetch JSON
    const response = await fetch(
      "https://raw.githubusercontent.com/TIDYBEATS1/coming-soon/main/coming_soon.json"
    );
    const data = await response.json();

    // 2️⃣ Compute hash to detect changes
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");

    if (hash === lastHash) {
      console.log("ℹ️ No new Amiibos");
      return res.status(200).json({ status: "no-new-amiibos" });
    }

    lastHash = hash;
    console.log("🚀 New Amiibo JSON detected");

    // 3️⃣ Get all device tokens from Firebase
    const usersSnapshot = await db.collection("users").get();
    const tokens = usersSnapshot.docs
      .map((doc) => doc.data().deviceToken)
      .filter(Boolean);

    if (!tokens.length) {
      console.log("⚠️ No device tokens found");
      return res.status(200).json({ status: "no-tokens" });
    }

    // 4️⃣ Send notifications for each new Amiibo
    for (const amiibo of data) {
      const payload = {
        deviceToken: null,
        title: "New Amiibo!",
        bodyText: `${amiibo.name} is coming soon!`,
        useSandbox: true,
      };

      for (const token of tokens) {
        payload.deviceToken = token;
        await fetch(
          "https://coming-soon-one-lilac.vercel.app/api/sendNotification",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.API_SECRET_KEY,
            },
            body: JSON.stringify(payload),
          }
        );
      }
    }

    console.log(`✅ Notifications sent to ${tokens.length} users`);
    res.status(200).json({ status: "notifications-sent", users: tokens.length });
  } catch (error) {
    console.error("❌ Error in check-new-amiibo:", error);
    res.status(500).json({ status: "error", error: error.message });
  }
}

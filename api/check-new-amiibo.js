// /api/check-new-amiibo.js
import crypto from "crypto";
import admin from "firebase-admin";
import fetch from "node-fetch";
import apn from "apn";
import { NextResponse } from "next/server";

let lastHash = "";

// Initialize Firebase Admin once
if (!admin.apps.length) {
  const rawServiceAccount = process.env.FIREBASE_ADMIN_SDK;
  if (!rawServiceAccount) throw new Error("FIREBASE_ADMIN_SDK environment variable not set");

  const serviceAccount = JSON.parse(rawServiceAccount);
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

  console.log("Initializing Firebase with project:", serviceAccount.project_id);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();

export async function GET() {
  try {
    // 1️⃣ Fetch the JSON from GitHub
    const response = await fetch(
      "https://raw.githubusercontent.com/TIDYBEATS1/coming-soon/main/coming_soon.json"
    );
    const data = await response.json();

    // 2️⃣ Compute hash to check for new data
    const hash = crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
    if (hash === lastHash) {
      return NextResponse.json({ status: "no-new-amiibos" });
    }
    lastHash = hash;

    // 3️⃣ Get all device tokens from Firestore
    const usersSnapshot = await db.collection("users").get();
    const tokens = usersSnapshot.docs
      .map((doc) => doc.data().deviceToken)
      .filter(Boolean);

    if (!tokens.length) {
      console.log("No device tokens found");
      return NextResponse.json({ status: "no-tokens" });
    }

    // 4️⃣ APNS secrets
    const teamId = process.env.APNS_TEAM_ID;
    const keyId = process.env.APNS_KEY_ID;
    const bundleId = process.env.APP_BUNDLE_ID;
    const privateKey = process.env.APPLE_AUTH_KEY?.replace(/\\n/g, "\n");

    if (!teamId || !keyId || !bundleId || !privateKey) {
      throw new Error("Missing APNS credentials");
    }

    // 5️⃣ Configure APN provider
    const apnProvider = new apn.Provider({
      token: { key: privateKey, keyId, teamId },
      production: false, // set to true for production
    });

    // 6️⃣ Send notifications
    for (const amiibo of data) {
      const notification = new apn.Notification({
        alert: { title: "New Amiibo!", body: `${amiibo.name} is coming soon!` },
        sound: "default",
        topic: bundleId,
        pushType: "alert",
      });

      const result = await apnProvider.send(notification, tokens);
      console.log(`Sent notification for ${amiibo.name}:`, result);
    }

    apnProvider.shutdown();

    return NextResponse.json({ status: "notifications-sent", users: tokens.length });
  } catch (error) {
    console.error("Error in check-new-amiibo:", error);
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }
}

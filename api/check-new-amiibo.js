// /api/check-new-amiibo.js
import crypto from "crypto";
import admin from "firebase-admin";
import fetch from "node-fetch";
import { NextResponse } from "next/server";

let lastHash = "";

// Initialize Firebase Admin once
if (!admin.apps.length) {
  const rawServiceAccount = process.env.FIREBASE_ADMIN_SDK;
  if (!rawServiceAccount) {
    throw new Error("FIREBASE_ADMIN_SDK environment variable is not set");
  }

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
    // 1️⃣ Fetch JSON from GitHub
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

    // 3️⃣ Get all users' device tokens from Firestore
    const usersSnapshot = await db.collection("users").get();
    const tokens = usersSnapshot.docs
      .map((doc) => doc.data().deviceToken)
      .filter(Boolean);

    // 4️⃣ Send notification for each Amiibo to each device token
    for (const amiibo of data) {
      for (const token of tokens) {
        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/sendNotification`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.API_SECRET_KEY,
              },
              body: JSON.stringify({
                deviceToken: token,
                title: "New Amiibo!",
                bodyText: `${amiibo.name} is coming soon!`,
                useSandbox: true,
              }),
            }
          );
        } catch (err) {
          console.error("Failed to send notification for", amiibo.name, err);
        }
      }
    }

    return NextResponse.json({ status: "notifications-sent", users: tokens.length });
  } catch (error) {
    console.error("Error in check-new-amiibo:", error);
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }
}

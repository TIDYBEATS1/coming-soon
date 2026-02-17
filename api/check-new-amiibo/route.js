import { NextResponse } from "next/server";
import fetch from "node-fetch";
import crypto from "crypto";
import admin from "firebase-admin";

let lastHash = "";

// Initialize Firebase with service account from environment variable
if (!admin.apps.length) {
  const rawServiceAccount = process.env.FIREBASE_ADMIN_SDK;
  if (!rawServiceAccount) throw new Error("FIREBASE_ADMIN_SDK environment variable not set");

  const serviceAccount = JSON.parse(rawServiceAccount);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}
const db = admin.firestore();

export async function GET() {
  try {
    // Fetch JSON from GitHub
    const response = await fetch(
      "https://raw.githubusercontent.com/TIDYBEATS1/coming-soon/main/coming_soon.json"
    );
    const data = await response.json();

    // Check if JSON has changed
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");

    if (hash === lastHash) {
      return NextResponse.json({ status: "no-new-amiibos" });
    }
    lastHash = hash;

    // Get all users' device tokens from Firebase
    const usersSnapshot = await db.collection("users").get();
    const tokens = usersSnapshot.docs
      .map((doc) => doc.data().deviceToken)
      .filter(Boolean);

    // Send notifications in parallel
    const notifications = [];
    for (const amiibo of data) {
      for (const token of tokens) {
        notifications.push(
          fetch("https://coming-soon-one-lilac.vercel.app/api/sendNotification", {
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
          })
        );
      }
    }
    await Promise.all(notifications);

    return NextResponse.json({ status: "notifications-sent", users: tokens.length });
  } catch (error: any) {
    console.error("Error in check-new-amiibo:", error);
    return NextResponse.json({ status: "error", error: error.message });
  }
}

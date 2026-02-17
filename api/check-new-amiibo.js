// api/check-new-amiibo/check-new-amiibo.js
import fetch from "node-fetch";
import crypto from "crypto";
import admin from "firebase-admin";
import sendNotification from "./sendNotification.js";

let lastHash = "";

// Initialize Firebase
if (!admin.apps.length) {
  const rawServiceAccount = process.env.FIREBASE_ADMIN_SDK;
  if (!rawServiceAccount) {
    throw new Error("FIREBASE_ADMIN_SDK environment variable is not set");
  }

  const serviceAccount = JSON.parse(rawServiceAccount);
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();

export default async function checkNewAmiibo() {
  try {
    // Fetch JSON from GitHub
    const response = await fetch(
      "https://raw.githubusercontent.com/TIDYBEATS1/coming-soon/main/coming_soon.json"
    );
    const data = await response.json();

    // Create hash to check for changes
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");

    if (hash === lastHash) {
      console.log("No new Amiibos detected");
      return;
    }
    lastHash = hash;
    console.log("🚀 New Amiibo JSON detected");

    // Get all users' device tokens from Firebase
    const usersSnapshot = await db.collection("users").get();
    const tokens = usersSnapshot.docs
      .map((doc) => doc.data().deviceToken)
      .filter(Boolean);

    // Send notification for each new Amiibo
    for (const amiibo of data) {
      for (const token of tokens) {
        await sendNotification(token, {
          title: "New Amiibo!",
          bodyText: `${amiibo.name} is coming soon!`,
          useSandbox: true,
        });
      }
    }

    console.log(`Notifications sent to ${tokens.length} users`);
  } catch (error) {
    console.error("❌ Error in check-new-amiibo:", error);
  }
}

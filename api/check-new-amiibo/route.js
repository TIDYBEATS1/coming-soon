import fetch from "node-fetch";
import crypto from "crypto";
import admin from "firebase-admin";

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

// Serverless handler
export async function handler(event) {
  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/TIDYBEATS1/coming-soon/main/coming_soon.json"
    );
    const data = await response.json();

    const hash = crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");

    if (hash === lastHash) {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: "no-new-amiibos" }),
      };
    }
    lastHash = hash;

    const usersSnapshot = await db.collection("users").get();
    const tokens = usersSnapshot.docs
      .map((doc) => doc.data().deviceToken)
      .filter(Boolean);

    for (const amiibo of data) {
      for (const token of tokens) {
        await fetch(
          "https://coming-soon-one-lilac.vercel.app/api/sendNotification",
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
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ status: "notifications-sent", users: tokens.length }),
    };
  } catch (error) {
    console.error("Error in check-new-amiibo:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "error", error: error.message }),
    };
  }
}

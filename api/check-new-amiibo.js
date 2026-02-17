import fetch from "node-fetch";
import crypto from "crypto";
import admin from "firebase-admin";

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

export async function GET() {
  try {
    // 1️⃣ Fetch JSON from GitHub
    const response = await fetch(
      "https://raw.githubusercontent.com/TIDYBEATS1/coming-soon/main/coming_soon.json"
    );
    const data = await response.json();

    // 2️⃣ Compute new hash
    const hash = crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");

    // 3️⃣ Get last stored hash from Firestore
    const hashDocRef = db.collection("meta").doc("lastAmiiboHash");
    const hashDoc = await hashDocRef.get();
    const lastHash = hashDoc.exists ? hashDoc.data()?.hash : null;

    if (hash === lastHash) {
      return { status: "no-new-amiibos" };
    }

    // 4️⃣ Update Firestore with new hash
    await hashDocRef.set({ hash });

    // 5️⃣ Get all users' device tokens
    const usersSnapshot = await db.collection("users").get();
    const tokens = usersSnapshot.docs
      .map((doc) => doc.data().deviceToken)
      .filter(Boolean);

    // 6️⃣ Send notifications
    for (const amiibo of data) {
      for (const token of tokens) {
        await fetch("https://coming-soon-one-lilac.vercel.app/api/sendNotification", {
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
        });
      }
    }

    return { status: "notifications-sent", users: tokens.length };
  } catch (error) {
    console.error("Error in check-new-amiibo:", error);
    return { status: "error", error: error.message };
  }
}

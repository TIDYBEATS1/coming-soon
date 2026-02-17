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

    // 2️⃣ Load already notified Amiibo IDs from Firestore
    const notifiedDocRef = db.collection("meta").doc("notifiedAmiibos");
    const notifiedDoc = await notifiedDocRef.get();
    const notifiedIds = notifiedDoc.exists ? notifiedDoc.data()?.ids || [] : [];

    // 3️⃣ Find new Amiibos that haven't been notified yet
    const newAmiibos = data.filter((amiibo) => !notifiedIds.includes(amiibo.id));

    if (newAmiibos.length === 0) {
      return { status: "no-new-amiibos" };
    }

    // 4️⃣ Send notifications for new Amiibos
    const usersSnapshot = await db.collection("users").get();
    const tokens = usersSnapshot.docs
      .map((doc) => doc.data().deviceToken)
      .filter(Boolean);

    for (const amiibo of newAmiibos) {
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

    // 5️⃣ Update Firestore with newly notified Amiibo IDs
    const updatedIds = [...new Set([...notifiedIds, ...newAmiibos.map((a) => a.id)])];
    await notifiedDocRef.set({ ids: updatedIds });

    return { status: "notifications-sent", newAmiibos: newAmiibos.length, users: tokens.length };
  } catch (error) {
    console.error("Error in check-new-amiibo:", error);
    return { status: "error", error: error.message };
  }
}

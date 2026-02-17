import fetch from "node-fetch";
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
    // Fetch JSON from GitHub
    const response = await fetch(
      "https://raw.githubusercontent.com/TIDYBEATS1/coming-soon/main/coming_soon.json"
    );
    const data = await response.json();

    // Get previously notified Amiibo IDs
    const docRef = db.collection("notifications").doc("notifiedAmiibos");
    const docSnap = await docRef.get();
    const notifiedIds = docSnap.exists ? docSnap.data()?.ids || [] : [];

    // Filter only new Amiibos
    const newAmiibos = data.filter(amiibo => !notifiedIds.includes(amiibo.id));
    if (newAmiibos.length === 0) {
      return { status: "no-new-amiibos" };
    }

    // Get all users' device tokens
    const usersSnapshot = await db.collection("users").get();
    const tokens = usersSnapshot.docs.map(doc => doc.data().deviceToken).filter(Boolean);

    const newlySentIds: string[] = [];

    // Send notifications
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
      newlySentIds.push(amiibo.id);
    }

    // Update Firestore to mark these Amiibos as notified
    await docRef.set({ ids: [...notifiedIds, ...newlySentIds] }, { merge: true });

    return { status: "notifications-sent", users: tokens.length, newAmiibos: newlySentIds.length };
  } catch (error) {
    console.error("Error in check-new-amiibo:", error);
    return { status: "error", error: error.message };
  }
}

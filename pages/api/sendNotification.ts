import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { deviceToken, title, bodyText } = body;

  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const bundleId = process.env.APP_BUNDLE_ID;
  const privateKey = process.env.APPLE_AUTH_KEY?.replace(/\\n/g, '\n');

  if (!teamId || !keyId || !bundleId || !privateKey) {
    return NextResponse.json({ error: "Missing secrets" }, { status: 500 });
  }

  // Create JWT for APNS
  const token = jwt.sign(
    {
      iss: teamId,
      iat: Math.floor(Date.now() / 1000)
    },
    privateKey,
    { algorithm: "ES256", header: { alg: "ES256", kid: keyId } }
  );

  // APNS request
  const apnsResponse = await fetch(
    `https://api.sandbox.push.apple.com/3/device/${deviceToken}`,
    {
      method: "POST",
      headers: {
        "authorization": `bearer ${token}`,
        "apns-topic": bundleId,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        aps: {
          alert: {
            title: title,
            body: bodyText
          },
          sound: "default"
        }
      })
    }
  );

  return NextResponse.json({ status: apnsResponse.status });
}

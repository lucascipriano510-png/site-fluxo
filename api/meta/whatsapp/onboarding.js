import { createCipheriv, randomBytes } from "node:crypto";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v25.0";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(body);
}

function validMetaId(value) {
  return /^\d{5,32}$/.test(String(value || ""));
}

function encryptAccessToken(token) {
  const keyValue = process.env.META_TOKEN_ENCRYPTION_KEY || "";
  const key = Buffer.from(keyValue, "base64");
  if (key.length !== 32) throw new Error("META_TOKEN_ENCRYPTION_KEY is invalid");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

async function getAuthenticatedUser(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ") || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth },
  });
  return response.ok ? response.json() : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const required = [
    "META_APP_ID",
    "META_APP_SECRET",
    "META_WHATSAPP_CONFIG_ID",
    "META_BUSINESS_ID",
    "META_ADMIN_USER_ID",
    "META_TOKEN_ENCRYPTION_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  if (required.some((name) => !process.env[name])) {
    console.error("[whatsapp-onboarding] missing required server configuration");
    return json(res, 503, { error: "Onboarding is not configured on the server." });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user || user.id !== process.env.META_ADMIN_USER_ID)
      return json(res, 401, { error: "Unauthorized" });

    const { code, waba_id: wabaId, phone_number_id: phoneNumberId } = req.body || {};
    if (
      typeof code !== "string" ||
      code.length < 8 ||
      code.length > 4096 ||
      !validMetaId(wabaId) ||
      !validMetaId(phoneNumberId)
    ) {
      return json(res, 400, { error: "Invalid onboarding payload." });
    }

    const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", process.env.META_APP_ID);
    tokenUrl.searchParams.set("client_secret", process.env.META_APP_SECRET);
    tokenUrl.searchParams.set("code", code);
    const tokenResponse = await fetch(tokenUrl, { headers: { Accept: "application/json" } });
    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    const accessToken =
      typeof tokenPayload.access_token === "string" ? tokenPayload.access_token : "";
    if (!tokenResponse.ok || !accessToken) {
      console.warn("[whatsapp-onboarding] Meta token exchange failed", {
        status: tokenResponse.status,
      });
      return json(res, 502, { error: "Meta did not authorize the connection." });
    }

    const encrypted = encryptAccessToken(accessToken);
    const connection = {
      business_id: process.env.META_BUSINESS_ID,
      waba_id: String(wabaId),
      phone_number_id: String(phoneNumberId),
      meta_app_id: process.env.META_APP_ID,
      status: "connected",
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      access_token_ciphertext: encrypted.ciphertext,
      access_token_iv: encrypted.iv,
      access_token_tag: encrypted.tag,
    };
    const saveResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/whatsapp_meta_connections?on_conflict=business_id,waba_id,phone_number_id`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(connection),
      },
    );
    if (!saveResponse.ok) {
      console.error("[whatsapp-onboarding] unable to persist connection", {
        status: saveResponse.status,
      });
      return json(res, 500, { error: "Could not save the connection." });
    }

    return json(res, 200, {
      ok: true,
      status: "connected",
      waba_id: String(wabaId),
      phone_number_id: String(phoneNumberId),
    });
  } catch (error) {
    console.error("[whatsapp-onboarding] unexpected failure", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return json(res, 500, { error: "Unexpected server error." });
  }
}

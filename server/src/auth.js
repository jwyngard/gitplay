// Sign in with Apple verification + this server's own session tokens.
// See docs/APP_STORE_AND_PAYWALL_PLAN.md section 5 for the flow this
// implements: the iOS app's native Sign in with Apple prompt hands us an
// Apple-signed identity token once; we verify it, look up/create the user,
// and hand back our own session token for every API call after that --
// the app never needs to re-run Sign in with Apple just to make a request.

import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

// The native Sign in with Apple flow (as opposed to the web/redirect flow)
// sets the token's audience to the app's bundle ID, not a separate
// Services ID -- so this must match capacitor.config.json's appId.
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || "com.alumniwatch.app";

// Not validated at import time -- this module is imported by the main
// server process, which must keep working on a deployment that hasn't set
// up accounts yet. An unconfigured SESSION_SECRET instead means any actual
// auth attempt fails clearly (caught by index.js's error middleware) the
// first time a session token is issued or checked, not a boot crash.
function sessionSecret() {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required (see docs/APP_STORE_AND_PAYWALL_PLAN.md)");
  }
  return new TextEncoder().encode(process.env.SESSION_SECRET);
}

// Verifies a raw identity token from the iOS app's native Sign in with
// Apple prompt. Throws on anything invalid (wrong signature, expired,
// wrong issuer/audience) -- callers should treat any throw as "reject the
// login," not attempt to partially trust the payload.
export async function verifyAppleIdentityToken(identityToken) {
  const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
    issuer: APPLE_ISSUER,
    audience: APPLE_BUNDLE_ID,
  });
  // `sub` is Apple's stable, opaque per-user identifier -- safe as a
  // permanent primary key, unlike email (users can hide their real email
  // behind Apple's relay, and either way email isn't guaranteed present on
  // logins after the first one).
  return { appleUserId: payload.sub, email: payload.email ?? null };
}

export async function issueSessionToken(userId) {
  return new SignJWT({ userId: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(sessionSecret());
}

async function verifySessionToken(token) {
  const { payload } = await jwtVerify(token, sessionSecret());
  return payload.userId;
}

// Express middleware -- rejects with 401 rather than throwing, since a
// missing/expired/tampered token is an expected, routine case (not a bug),
// not something that should hit the generic error handler.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return res.status(401).json({ error: "Missing Authorization header" });

  try {
    req.userId = await verifySessionToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { Purchases } from "@revenuecat/purchases-capacitor";
import {
  signInWithApple,
  getEntitlement,
  getSavedPlayersRemote,
  savePlayerRemote,
  removePlayerRemote,
  importSavedPlayersRemote,
  RosterLimitError,
} from "./api.js";

const TOKEN_KEY = "alumniWatch.sessionToken";
const USER_ID_KEY = "alumniWatch.userId";

// RevenueCat's "public app-specific API key" -- meant to ship inside client
// apps, not a secret (see web/.env.capacitor). Left unset on the plain web
// build, where this whole hook is an inert shell anyway.
const REVENUECAT_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY;

// The RevenueCat entitlement identifier (set up in the RevenueCat
// dashboard) that unlocks an unlimited roster -- must be named exactly this
// there, to match the "unlimited" tier name accounts.js already uses.
const UNLIMITED_ENTITLEMENT = "unlimited";

// clientId/redirectURI are required by this plugin's TypeScript signature,
// but only matter for its web/Android OAuth-redirect fallback. The actual
// native iOS flow (ASAuthorizationAppleIDProvider under the hood) ignores
// both and always issues a token audienced to the app's own bundle ID --
// which is what the server verifies against (see server/src/auth.js).
const APPLE_SIGN_IN_OPTIONS = {
  clientId: "com.alumniwatch.app",
  redirectURI: "https://alumni-watch-v1dg.onrender.com/auth/callback",
};

function mapServerPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    teamName: p.team_name,
    teamLogo: p.team_logo,
    year: p.year,
  };
}

// Server-backed counterpart to useSavedPlayers.js (localStorage) -- same
// savedPlayers/isSaved/savePlayer/removePlayer shape, so the rest of the
// app (RosterList, PlayerCardModal, ResultsPanel) doesn't need to know
// which one it's talking to. Only meaningful on the native iOS app; on web
// this is an inert shell (isNative: false, everything else a no-op) so it's
// safe to call unconditionally regardless of platform.
export function useAccountRoster() {
  const isNative = Capacitor.isNativePlatform();
  const [token, setToken] = useState(() => (isNative ? localStorage.getItem(TOKEN_KEY) : null));
  const [userId, setUserId] = useState(() => (isNative ? localStorage.getItem(USER_ID_KEY) : null));
  const [savedPlayers, setSavedPlayers] = useState([]);
  const [entitlement, setEntitlement] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [purchaseError, setPurchaseError] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  // Configure (or re-identify) the RevenueCat SDK with our own user id, so
  // its app_user_id lines up with what the server's webhook handler expects
  // (see server/src/index.js's /api/webhooks/revenuecat). Safe to call more
  // than once -- configure() just re-configures with the same key/id.
  const configureRevenueCat = useCallback(async (uid) => {
    if (!isNative || !REVENUECAT_API_KEY || !uid) return;
    try {
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: String(uid) });
    } catch (err) {
      console.error("RevenueCat configure failed", err);
    }
  }, [isNative]);

  const refresh = useCallback(async (tok) => {
    try {
      const [players, ent] = await Promise.all([getSavedPlayersRemote(tok), getEntitlement(tok)]);
      setSavedPlayers(players.map(mapServerPlayer));
      setEntitlement(ent);
    } catch {
      // An expired/invalid session -- drop it locally rather than getting
      // stuck retrying a dead token on every render.
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setSavedPlayers([]);
      setEntitlement(null);
    }
  }, []);

  useEffect(() => {
    if (isNative && token) refresh(token);
  }, [isNative, token, refresh]);

  // Re-identify RevenueCat on every app launch that restores a session, not
  // just on a fresh sign-in -- otherwise a relaunched app would be making
  // purchase/entitlement calls under RevenueCat's anonymous id instead of
  // this user's.
  useEffect(() => {
    if (isNative && token && userId) configureRevenueCat(userId);
  }, [isNative, token, userId, configureRevenueCat]);

  async function signIn() {
    if (!isNative) return false;
    setAuthError(null);
    try {
      const result = await SignInWithApple.authorize(APPLE_SIGN_IN_OPTIONS);
      const { sessionToken, userId: newUserId } = await signInWithApple(result.response.identityToken);
      localStorage.setItem(TOKEN_KEY, sessionToken);
      localStorage.setItem(USER_ID_KEY, String(newUserId));
      setToken(sessionToken);
      setUserId(newUserId);
      await configureRevenueCat(newUserId);
      await refresh(sessionToken);
      return sessionToken;
    } catch (err) {
      setAuthError(err.message || "Sign in with Apple failed");
      return false;
    }
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    setToken(null);
    setUserId(null);
    setSavedPlayers([]);
    setEntitlement(null);
    if (isNative && REVENUECAT_API_KEY) {
      Purchases.logOut().catch(() => {});
    }
  }

  // customerInfo.entitlements.active is keyed by RevenueCat entitlement
  // identifier -- reflects the purchase immediately, so the UI doesn't have
  // to wait on the webhook (server/src/index.js) to round-trip before
  // unlocking. The webhook still runs and is what actually persists the
  // "unlimited" tier server-side for every future request.
  function applyCustomerInfo(customerInfo) {
    const active = Boolean(customerInfo?.entitlements?.active?.[UNLIMITED_ENTITLEMENT]);
    if (active) {
      setEntitlement({ tier: "unlimited", renews_at: null });
      setLimitReached(false);
    }
    return active;
  }

  async function purchaseUnlimited() {
    if (!isNative || !REVENUECAT_API_KEY) {
      setPurchaseError("Purchases aren't available.");
      return false;
    }
    setPurchaseError(null);
    setPurchasing(true);
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages?.[0];
      if (!pkg) {
        setPurchaseError("No subscription is available right now.");
        return false;
      }
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      return applyCustomerInfo(customerInfo);
    } catch (err) {
      if (!err?.userCancelled) setPurchaseError(err.message || "Purchase failed");
      return false;
    } finally {
      setPurchasing(false);
    }
  }

  async function restorePurchases() {
    if (!isNative || !REVENUECAT_API_KEY) return false;
    setPurchaseError(null);
    setPurchasing(true);
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      const active = applyCustomerInfo(customerInfo);
      if (!active) setPurchaseError("No previous purchase found to restore.");
      return active;
    } catch (err) {
      setPurchaseError(err.message || "Restore failed");
      return false;
    } finally {
      setPurchasing(false);
    }
  }

  function isSaved(id) {
    return savedPlayers.some((p) => p.id === id);
  }

  async function savePlayer(player, team, year) {
    if (!isNative) return;
    setLimitReached(false);
    let tok = token;
    if (!tok) {
      tok = await signIn();
      if (!tok) return;
    }
    try {
      const players = await savePlayerRemote(tok, player, team, year);
      setSavedPlayers(players.map(mapServerPlayer));
    } catch (err) {
      if (err instanceof RosterLimitError) setLimitReached(true);
      else setAuthError(err.message);
    }
  }

  async function removePlayer(id) {
    if (!isNative || !token) return;
    const players = await removePlayerRemote(token, id);
    setSavedPlayers(players.map(mapServerPlayer));
  }

  // One-time migration of a pre-accounts localStorage roster -- see
  // docs/APP_STORE_AND_PAYWALL_PLAN.md section 7. Called from
  // SavedPlayersContext right after a successful sign-in, since that's the
  // one place both this hook's state and the localStorage hook's state are
  // both in scope together.
  async function importLocalRoster(localPlayers) {
    if (!isNative || !token || !localPlayers?.length) return null;
    const result = await importSavedPlayersRemote(token, localPlayers);
    setSavedPlayers(result.savedPlayers.map(mapServerPlayer));
    return result;
  }

  return {
    isNative,
    isSignedIn: Boolean(token),
    signIn,
    signOut,
    authError,
    savedPlayers,
    isSaved,
    savePlayer,
    removePlayer,
    importLocalRoster,
    entitlement,
    limitReached,
    dismissLimitNotice: () => setLimitReached(false),
    purchaseUnlimited,
    restorePurchases,
    purchasing,
    purchaseError,
  };
}

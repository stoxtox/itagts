// src/services/analytics.js
import { logEvent } from "firebase/analytics";
import { analyticsPromise } from "../firebase";

/**
 * Track an event in Firebase Analytics.
 * Safe to call anywhere — no-ops if analytics isn't supported.
 */
export async function trackEvent(eventName, params = {}) {
  try {
    const analytics = await analyticsPromise;
    if (analytics) {
      logEvent(analytics, eventName, params);
    }
  } catch (err) {
    // Silently ignore analytics errors — they should never break the app
    console.warn("[Analytics]", err.message);
  }
}

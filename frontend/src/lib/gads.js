/**
 * Google Ads Conversion Tracking Helpers.
 *
 * Conversion-ID is loaded globally via gtag.js in /public/index.html (AW-18187044875).
 *
 * USAGE:
 *   1. Create a Conversion Action in Google Ads dashboard (https://ads.google.com → Tools → Conversions)
 *   2. Copy the conversion label (looks like 'AbC-D_efGhIjKlMnOp')
 *   3. Paste it into the LABELS map below
 *   4. Call e.g. `trackConversion('signup')` at the moment the conversion happens
 *
 * Until labels are filled, calls are no-ops (safe to ship).
 */

const CONVERSION_ID = "AW-18187044875";

// PASTE YOUR CONVERSION LABELS HERE (from Google Ads dashboard):
const LABELS = {
  signup: "",         // e.g. "AbCdEfGhIjK-LmNoPq"
  premium_purchase: "", // fires after successful Stripe checkout
};

/**
 * Fire a Google Ads conversion.
 * @param {keyof typeof LABELS} name - which conversion to fire
 * @param {object} [opts] - optional value/currency/transaction_id
 */
export function trackConversion(name, opts = {}) {
  const label = LABELS[name];
  if (!label) return; // not configured yet — no-op
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  const payload = {
    send_to: `${CONVERSION_ID}/${label}`,
    ...opts,
  };
  try {
    window.gtag("event", "conversion", payload);
  } catch (e) {
    // Silent fail — never block UX on analytics
  }
}

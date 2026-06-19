// AlphaFit Web Push helper
import api from "./api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export async function getPushPermission() {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

async function getServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("ServiceWorker nicht unterstützt");
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function subscribePush({ triggers, reminderTime } = {}) {
  if (!isPushSupported()) throw new Error("Push wird auf diesem Gerät nicht unterstützt");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Berechtigung verweigert");

  const reg = await getServiceWorker();
  await navigator.serviceWorker.ready;

  // Fetch VAPID key
  const { data } = await api.get("/notifications/vapid-public-key");
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.public_key),
  });
  const json = sub.toJSON();
  const tz_offset = -new Date().getTimezoneOffset(); // minutes from UTC
  await api.post("/notifications/subscribe", {
    endpoint: json.endpoint,
    keys: json.keys,
    triggers: triggers || { workout_reminder: true, streak_protect: true, weekly_review: true },
    reminder_time: reminderTime || "18:00",
    timezone_offset: tz_offset,
  });
  return json.endpoint;
}

export async function unsubscribePush() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  try {
    await api.delete(`/notifications/unsubscribe?endpoint=${encodeURIComponent(endpoint)}`);
  } catch {}
}

export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  return sub ? sub.toJSON() : null;
}

export async function updatePushSettings({ endpoint, triggers, reminderTime }) {
  const tz_offset = -new Date().getTimezoneOffset();
  await api.put("/notifications/settings", {
    endpoint,
    keys: {},
    triggers,
    reminder_time: reminderTime,
    timezone_offset: tz_offset,
  });
}

export async function sendTestPush() {
  await api.post("/notifications/test", {
    title: "🛡️ AlphaFit Test",
    body: "Push funktioniert. Werde alpha.",
  });
}

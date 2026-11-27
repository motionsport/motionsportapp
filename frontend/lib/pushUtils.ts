import { api } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// For whoever is signed in now; the server upserts by endpoint
export async function syncSubscription(sub: PushSubscription) {
  const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
  await api.subscribePush({ endpoint: json.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" });
}

// Logout switched it off on the server; this turns it back on without a new permission prompt. Allowed but with no
// subscription (the browser dropped it): subscribe again, still with no prompt
export async function resyncExistingSubscription() {
  try {
    if (!("serviceWorker" in navigator)) return;
    if ("Notification" in window && Notification.permission === "granted") {
      await ensurePushSubscribed();
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    const existing = await reg?.pushManager?.getSubscription();
    if (existing) await syncSubscription(existing);
  } catch {
    // Deliberately empty: no push support or offline
  }
}

// Whether this browser can get pushes at all (Safari on iPhone outside the installed app can't) and what the person
// said; «pushchange» tells the home page's status line that it may have changed (a tap on «Сповістити про вільне місце»)
export type PushPermission = "unsupported" | NotificationPermission;
export function pushPermission(): PushPermission {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return supported ? Notification.permission : "unsupported";
}
export const PUSH_CHANGE = "pushchange";

export async function ensurePushSubscribed(): Promise<boolean> {
  try {
    return await subscribe();
  } finally {
    window.dispatchEvent(new Event(PUSH_CHANGE));
  }
}

async function subscribe(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (Notification.permission === "denied") return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    // May be registered under the other role, so register it again
    if (existing) {
      await syncSubscription(existing);
      return true;
    }

    const { publicKey } = await api.getVapidPublicKey();
    if (!publicKey) return false;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    });

    await syncSubscription(sub);
    return true;
  } catch {
    return false;
  }
}

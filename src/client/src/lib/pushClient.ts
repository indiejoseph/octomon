export function isIOS(): boolean {
  return (
    ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(
      navigator.platform
    ) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
  );
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

export function checkPushSupport(): { supported: boolean; reason?: string } {
  if (!('serviceWorker' in navigator)) {
    return {
      supported: false,
      reason: 'Service Workers are not supported in this browser environment.'
    };
  }

  if (!('PushManager' in window)) {
    if (isIOS() && !isStandalone()) {
      return {
        supported: false,
        reason:
          'On iPhone/iPad (iOS), Apple requires adding this web app to your Home Screen first to enable Web Push. Tap the Share button (⬆️) and select "Add to Home Screen".'
      };
    }
    return {
      supported: false,
      reason: 'Push notifications are not supported in this browser.'
    };
  }

  return { supported: true };
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const support = checkPushSupport();
  if (!support.supported) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeUserToPush(): Promise<PushSubscription> {
  const support = checkPushSupport();
  if (!support.supported) {
    throw new Error(support.reason || 'Web Push is not supported in this browser.');
  }

  // 1. Fetch public VAPID key from Worker
  const res = await fetch('/api/vapid-public-key');
  if (!res.ok) {
    throw new Error('Failed to retrieve VAPID public key from server');
  }
  const { publicKey } = await res.json();

  // 2. Request browser permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted. Please allow notifications in your browser/iOS settings.');
  }

  // 3. Register push manager subscription
  const reg = await navigator.serviceWorker.ready;
  const convertedKey = urlBase64ToUint8Array(publicKey);

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedKey
  });

  return subscription;
}

export async function sendSubscriptionToServer(
  subscription: PushSubscription,
  options: {
    region: string;
    lowRateThreshold: number;
    notifyTomorrowNegative: boolean;
    notifyCurrentPlunge: boolean;
  }
): Promise<void> {
  const subJson = subscription.toJSON();
  const res = await fetch('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      keys: subJson.keys,
      ...options
    })
  });

  if (!res.ok) {
    throw new Error('Failed to save push subscription to Cloudflare Worker.');
  }
}

export async function triggerTestPush(subscription: PushSubscription): Promise<any> {
  const subJson = subscription.toJSON();
  const res = await fetch('/api/test-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      keys: subJson.keys
    })
  });
  return await res.json();
}

export async function unsubscribeUser(): Promise<boolean> {
  const sub = await getExistingSubscription();
  if (!sub) return true;

  await fetch('/api/subscriptions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint })
  });

  return await sub.unsubscribe();
}

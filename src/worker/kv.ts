import { Env, StoredSubscription, UserSettings } from './types';
import { generateVapidKeys } from './push';

const SETTINGS_KEY = 'settings:global';
const VAPID_KEY = 'keys:vapid';
const SUBS_PREFIX = 'sub:';

export async function getOrCreateVapidKeys(env: Env): Promise<{ publicKey: string; privateKey: string }> {
  // If provided in env vars, use those
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY
    };
  }

  // Otherwise check KV store
  if (env.OCTOPUS_KV) {
    const existing = await env.OCTOPUS_KV.get(VAPID_KEY, { type: 'json' }) as { publicKey: string; privateKey: string } | null;
    if (existing && existing.publicKey && existing.privateKey) {
      return existing;
    }

    // Generate new keys and persist in KV
    const newKeys = await generateVapidKeys();
    await env.OCTOPUS_KV.put(VAPID_KEY, JSON.stringify(newKeys));
    return newKeys;
  }

  // Fallback generation (in dev memory)
  return await generateVapidKeys();
}

export async function getSettings(env: Env): Promise<UserSettings> {
  const defaultSettings: UserSettings = {
    region: '_C', // London by default
    lowRateThreshold: 5.0, // 5p/kWh
    tariffCode: 'E-1R-AGILE-24-10-01-C',
    productCode: 'AGILE-24-10-01'
  };

  if (!env.OCTOPUS_KV) return defaultSettings;

  const stored = await env.OCTOPUS_KV.get(SETTINGS_KEY, { type: 'json' }) as UserSettings | null;
  return stored ? { ...defaultSettings, ...stored } : defaultSettings;
}

export async function saveSettings(env: Env, settings: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings(env);
  const updated: UserSettings = {
    ...current,
    ...settings
  };
  if (env.OCTOPUS_KV) {
    await env.OCTOPUS_KV.put(SETTINGS_KEY, JSON.stringify(updated));
  }
  return updated;
}

export async function saveSubscription(env: Env, sub: StoredSubscription): Promise<void> {
  if (!env.OCTOPUS_KV) return;
  await env.OCTOPUS_KV.put(`${SUBS_PREFIX}${sub.id}`, JSON.stringify(sub));
}

export async function removeSubscription(env: Env, subId: string): Promise<void> {
  if (!env.OCTOPUS_KV) return;
  await env.OCTOPUS_KV.delete(`${SUBS_PREFIX}${subId}`);
}

export async function getAllSubscriptions(env: Env): Promise<StoredSubscription[]> {
  if (!env.OCTOPUS_KV) return [];
  const list = await env.OCTOPUS_KV.list({ prefix: SUBS_PREFIX });
  const subs: StoredSubscription[] = [];

  for (const key of list.keys) {
    const data = await env.OCTOPUS_KV.get(key.name, { type: 'json' }) as StoredSubscription | null;
    if (data) {
      subs.push(data);
    }
  }
  return subs;
}

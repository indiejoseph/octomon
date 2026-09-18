import { Env, StoredSubscription } from './types';
import { fetchAgileRates, processRates, getCurrentSlot, analyzeDayRates, DEFAULT_PRODUCT } from './octopus';
import { getOrCreateVapidKeys, getSettings, saveSettings, saveSubscription, removeSubscription, getAllSubscriptions } from './kv';
import { sendWebPush } from './push';

export default {
  // 1. HTTP Request Router (API + Static Assets)
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Enable CORS for development
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    const jsonHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    };

    try {
      // API: Get VAPID Public Key for client subscription
      if (url.pathname === '/api/vapid-public-key' && request.method === 'GET') {
        const keys = await getOrCreateVapidKeys(env);
        return new Response(JSON.stringify({ publicKey: keys.publicKey }), {
          headers: jsonHeaders
        });
      }

      // API: Get User Settings
      if (url.pathname === '/api/settings' && request.method === 'GET') {
        const settings = await getSettings(env);
        return new Response(JSON.stringify(settings), { headers: jsonHeaders });
      }

      // API: Update User Settings
      if (url.pathname === '/api/settings' && request.method === 'POST') {
        const body = (await request.json()) as any;
        const updated = await saveSettings(env, body);
        return new Response(JSON.stringify(updated), { headers: jsonHeaders });
      }

      // API: Get Agile Rates & Analysis
      if (url.pathname === '/api/rates' && request.method === 'GET') {
        const settings = await getSettings(env);
        const region = url.searchParams.get('region') || settings.region;
        const threshold = parseFloat(url.searchParams.get('threshold') || String(settings.lowRateThreshold));
        const product = url.searchParams.get('product') || settings.productCode || DEFAULT_PRODUCT;

        const rawRates = await fetchAgileRates(region, product);
        const processed = processRates(rawRates, threshold);
        const currentSlot = getCurrentSlot(processed);

        // Find today and tomorrow date strings in UK time
        const now = new Date();
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now);
        const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
        const tomorrowStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(tomorrow);

        const todayAnalysis = analyzeDayRates(processed, todayStr);
        const tomorrowAnalysis = analyzeDayRates(processed, tomorrowStr);

        return new Response(
          JSON.stringify({
            currentSlot,
            today: todayAnalysis,
            tomorrow: tomorrowAnalysis,
            region,
            rates: processed
          }),
          { headers: jsonHeaders }
        );
      }

      // API: Register Web Push Subscription
      if (url.pathname === '/api/subscriptions' && request.method === 'POST') {
        const body = (await request.json()) as any;
        if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
          return new Response(JSON.stringify({ error: 'Invalid subscription object' }), {
            status: 400,
            headers: jsonHeaders
          });
        }

        const id = btoa(body.endpoint).slice(0, 32);
        const sub: StoredSubscription = {
          id,
          endpoint: body.endpoint,
          keys: body.keys,
          region: body.region || '_C',
          lowRateThreshold: typeof body.lowRateThreshold === 'number' ? body.lowRateThreshold : 5.0,
          notifyTomorrowNegative: body.notifyTomorrowNegative ?? true,
          notifyCurrentPlunge: body.notifyCurrentPlunge ?? true,
          createdAt: Date.now()
        };

        await saveSubscription(env, sub);
        return new Response(JSON.stringify({ success: true, id }), { headers: jsonHeaders });
      }

      // API: Test Push Notification
      if (url.pathname === '/api/test-push' && request.method === 'POST') {
        const body = (await request.json()) as any;
        const keys = await getOrCreateVapidKeys(env);
        const subject = env.VAPID_SUBJECT || 'mailto:octopus-monitor@local.dev';

        if (!body.endpoint || !body.keys) {
          return new Response(JSON.stringify({ error: 'Missing endpoint or keys' }), {
            status: 400,
            headers: jsonHeaders
          });
        }

        const result = await sendWebPush(
          body.endpoint,
          body.keys,
          {
            title: '🐙 Octopus Agile Alert Test',
            body: 'Push notifications are working! You will be alerted when rates plunge or turn negative.',
            url: '/'
          },
          keys.publicKey,
          keys.privateKey,
          subject
        );

        return new Response(JSON.stringify(result), { headers: jsonHeaders });
      }

      // API: Unsubscribe
      if (url.pathname === '/api/subscriptions' && request.method === 'DELETE') {
        const body = (await request.json()) as any;
        if (body.id) {
          await removeSubscription(env, body.id);
        } else if (body.endpoint) {
          const id = btoa(body.endpoint).slice(0, 32);
          await removeSubscription(env, id);
        }
        return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
      }

      // Fallback: If ASSETS binding is available, serve client static files
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }

      return new Response('Octopus Monitor API running.', { status: 200 });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || String(err) }), {
        status: 500,
        headers: jsonHeaders
      });
    }
  },

  // 2. Cron Triggers (Periodic rate checking & notification dispatching)
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const subscriptions = await getAllSubscriptions(env);
    if (subscriptions.length === 0) return;

    const keys = await getOrCreateVapidKeys(env);
    const subject = env.VAPID_SUBJECT || 'mailto:octopus-monitor@local.dev';

    // Group subscriptions by region to minimize Octopus API calls
    const subsByRegion = new Map<string, StoredSubscription[]>();
    for (const sub of subscriptions) {
      const reg = sub.region || '_C';
      if (!subsByRegion.has(reg)) {
        subsByRegion.set(reg, []);
      }
      subsByRegion.get(reg)!.push(sub);
    }

    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now);
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    const tomorrowStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(tomorrow);

    for (const [region, subs] of subsByRegion.entries()) {
      try {
        const rawRates = await fetchAgileRates(region);
        const processed = processRates(rawRates);
        const currentSlot = getCurrentSlot(processed);
        const tomorrowAnalysis = analyzeDayRates(processed, tomorrowStr);

        for (const sub of subs) {
          // Check 1: Tomorrow has negative rates alert (Trigger once per day when published)
          if (
            sub.notifyTomorrowNegative &&
            tomorrowAnalysis.hasNegative &&
            sub.lastNotifiedDate !== tomorrowStr
          ) {
            const minPrice = tomorrowAnalysis.minRate?.value_inc_vat.toFixed(2);
            const slotCount = tomorrowAnalysis.negativeSlots.length;
            const firstSlot = tomorrowAnalysis.negativeSlots[0].timeLabel;

            await sendWebPush(
              sub.endpoint,
              sub.keys,
              {
                title: '⚡ Negative Rates Tomorrow!',
                body: `Tomorrow has ${slotCount} negative slots starting at ${firstSlot} (lowest: ${minPrice}p/kWh). Time to schedule appliances!`,
                url: '/'
              },
              keys.publicKey,
              keys.privateKey,
              subject
            );

            sub.lastNotifiedDate = tomorrowStr;
            await saveSubscription(env, sub);
          }

          // Check 2: Current slot plunge or negative rate alert
          if (
            sub.notifyCurrentPlunge &&
            currentSlot &&
            (currentSlot.isNegative || currentSlot.value_inc_vat <= sub.lowRateThreshold)
          ) {
            if (sub.lastNotifiedSlot !== currentSlot.valid_from) {
              const isNeg = currentSlot.isNegative;
              const title = isNeg
                ? `🚨 Negative Rate Active Now: ${currentSlot.value_inc_vat.toFixed(2)}p/kWh!`
                : `🟢 Cheap Rate Active Now: ${currentSlot.value_inc_vat.toFixed(2)}p/kWh!`;

              const body = `Slot ${currentSlot.timeLabel} is now live at ${currentSlot.value_inc_vat.toFixed(2)}p. ${
                isNeg ? 'You get paid to use electricity!' : 'Great time to run high-energy appliances.'
              }`;

              await sendWebPush(
                sub.endpoint,
                sub.keys,
                {
                  title,
                  body,
                  url: '/'
                },
                keys.publicKey,
                keys.privateKey,
                subject
              );

              sub.lastNotifiedSlot = currentSlot.valid_from;
              await saveSubscription(env, sub);
            }
          }
        }
      } catch (err) {
        console.error(`Error processing scheduled checks for region ${region}:`, err);
      }
    }
  }
};

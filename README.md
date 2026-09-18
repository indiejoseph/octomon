# 🐙 Octopus Agile Rate Monitor (`octomon`)

A high-performance, mobile-first web app and notification engine for **Octopus Energy Agile** electricity tariffs. Deployed on **Cloudflare Workers** with **Cloudflare KV**, automated **Cron Triggers**, and native **W3C Web Push** notifications (with iOS PWA support).

Live Site: [https://octomon.josephcheng.me](https://octomon.josephcheng.me)

---

## ✨ Features

- ⚡ **Live Half-Hourly Rates**: Shows current slot unit rates (inc. VAT & exc. VAT), price trend vs the previous slot, and a real-time countdown to the next 30-minute transition.
- 📉 **Negative Plunge & Cheap Alerts**: Automatically categorizes rates into **Negative Plunge** (get paid to use electricity), **Cheap** (custom threshold e.g. $\le$ 5p/kWh), **Normal**, and **Peak** (16:00 - 19:00).
- 🔮 **Tomorrow's Forecast**: As soon as Octopus publishes tomorrow's rates (~16:00 UK time), the dashboard displays lowest, peak, and average prices, detailing every negative plunge slot.
- 📊 **Interactive 48-Slot Rate Curve**: Responsive bar chart with a zero-price baseline, threshold markers, and quick toggle between Today and Tomorrow.
- 📲 **Native Web Push Notifications**:
  - Delivers OS-level push notifications to your desktop, Android, and iPhone/iPad.
  - **Daily 16:05 UK Alert**: Pings when tomorrow contains negative slots so you can schedule appliances (EV charging, battery storage, laundry).
  - **Live Plunge Alert**: Pings whenever a negative or cheap rate slot begins.
- 📱 **Mobile & iOS PWA Ready**: Optimized touch controls, custom Octopus application icon, and full iOS Safari Add-to-Home-Screen support.
- 🔑 **Account & Tariff Auto-Detection**: Enter your Octopus API key and optional Account Number to automatically resolve your distribution region (DNO) and current tariff code.

---

## 🏗️ Architecture

```
                                  +------------------------------+
                                  |   Octopus Energy Public API  |
                                  +--------------+---------------+
                                                 |
                                     (Half-hourly Agile rates)
                                                 v
+------------------+   Subscribe    +------------+-------------+   Push Alert    +------------------+
|  User Browser /  | -------------> |  Cloudflare Worker Edge  | --------------> | Apple APNs / FCM |
|   iOS Home App   |                |  (Cron: */15m & 16:05)   | (VAPID ES256)   +--------+---------+
+--------+---------+                +------------+-------------+                          |
         ^                                       |                                        |
         |                                  (KV Storage)                                  |
         |                                       v                                        v
         |                          +------------+-------------+                +---------+--------+
         |                          | Cloudflare KV Store      |                | Service Worker   |
         +--------------------------+ (Subscriptions & Keys)   | <------------- | (sw.js popup)    |
                                    +--------------------------+                +------------------+
```

### Tech Stack
- **Edge Backend**: [Cloudflare Workers](https://workers.cloudflare.com/) (TypeScript / ES Modules)
- **Edge Storage**: [Cloudflare KV](https://developers.cloudflare.com/kv/)
- **Push Engine**: Web Crypto ECDSA P-256 (RFC 8291 `aes128gcm` + RFC 8292 VAPID JWT)
- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Recharts](https://recharts.org/), [Lucide Icons](https://lucide.dev/)

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone git@github.com:indiejoseph/octomon.git
cd octomon
npm install
```

### 2. Local Development
```bash
# Start the Vite client dev server
npm run dev

# Or test Cloudflare Worker locally
npm run dev:worker
```

---

## 🌐 Deployment to Cloudflare Workers

### 1. Login to Cloudflare
```bash
npx wrangler login
```

### 2. Configure Cloudflare KV
Create the KV namespace on your account:
```bash
npx wrangler kv namespace create OCTOPUS_KV
```
Update `wrangler.toml` with the generated `id`:
```toml
[[kv_namespaces]]
binding = "OCTOPUS_KV"
id = "your-kv-namespace-id"
```

### 3. Set VAPID Secrets (One-time)
Generate or set your VAPID keypair in Worker Secrets:
```bash
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
```

### 4. Build & Deploy
```bash
npm run deploy
```

---

## 📱 iPhone / iPad (iOS) Web Push Instructions

Apple requires web applications on iOS to be installed to the Home Screen to receive Web Push notifications:
1. Open the site in Safari: [https://octomon.josephcheng.me](https://octomon.josephcheng.me)
2. Tap the **Share** icon at the bottom of the screen.
3. Scroll down and tap **"Add to Home Screen"**.
4. Open the installed **Octopus Agile** app from your Home Screen.
5. In *Alerts & Preferences*, tap **"Enable Push"** and grant notification permissions.

---

## 📄 License

MIT License &copy; 2026 Joseph Cheng


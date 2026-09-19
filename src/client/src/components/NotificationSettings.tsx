import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Send, Sliders, CheckCircle2, AlertTriangle, MapPin, Share2, Smartphone } from 'lucide-react';
import { DNO_REGIONS } from '../types';
import {
  subscribeUserToPush,
  unsubscribeUser,
  sendSubscriptionToServer,
  triggerTestPush,
  checkPushSupport,
  isIOS,
  isStandalone
} from '../lib/pushClient';

interface NotificationSettingsProps {
  currentRegion: string;
  onChangeRegion: (region: string) => void;
  threshold: number;
  onChangeThreshold: (val: number) => void;
  isPushSubscribed: boolean;
  onSubscriptionChange: (subscribed: boolean) => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  currentRegion,
  onChangeRegion,
  threshold,
  onChangeThreshold,
  isPushSubscribed,
  onSubscriptionChange
}) => {
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);

  useEffect(() => {
    if (isIOS() && !isStandalone()) {
      setIosNeedsInstall(true);
    }
  }, []);

  const handleTogglePush = async () => {
    setLoading(true);
    setErrorMsg(null);
    setTestResult(null);

    try {
      if (isPushSubscribed) {
        await unsubscribeUser();
        onSubscriptionChange(false);
      } else {
        const sub = await subscribeUserToPush();
        await sendSubscriptionToServer(sub, {
          region: currentRegion,
          lowRateThreshold: threshold,
          notifyTomorrowNegative: true,
          notifyCurrentPlunge: true
        });
        onSubscriptionChange(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update notification subscription');
    } finally {
      setLoading(false);
    }
  };

  const [countdown, setCountdown] = useState<number | null>(null);

  const handleSendTest = async () => {
    setErrorMsg(null);
    setTestResult(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        throw new Error('Please enable push notifications first.');
      }

      // 3-second countdown so the user has time to lock their phone screen
      for (let sec = 3; sec > 0; sec--) {
        setCountdown(sec);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setCountdown(null);
      setLoading(true);

      const res = await triggerTestPush(sub);
      if (res.ok) {
        setTestResult(`Test notification sent! Gateway responded HTTP ${res.status || 201}. Check your lock screen / system notifications.`);
      } else {
        setErrorMsg(`Gateway error HTTP ${res.status || 'unknown'}: ${res.statusText || 'Push service rejected request'}`);
      }
    } catch (err: any) {
      setCountdown(null);
      setErrorMsg(err.message || 'Failed to send test push');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 backdrop-blur-sm">
      <div className="flex items-center gap-2.5 mb-4 sm:mb-6">
        <div className="p-2 sm:p-2.5 rounded-xl bg-slate-800 text-slate-200 shrink-0">
          <Sliders className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white">Alerts & Preferences</h3>
          <p className="text-[11px] sm:text-xs text-slate-400">
            Configure automated alerts for plunge rates and upcoming negative pricing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* UK DNO Region Selector */}
        <div>
          <label className="text-[11px] sm:text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            Octopus DNO Distribution Region
          </label>
          <select
            value={currentRegion}
            onChange={(e) => onChangeRegion(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
          >
            {Object.entries(DNO_REGIONS).map(([key, item]) => (
              <option key={key} value={key}>
                {item.name} ({item.code}) - {item.area}
              </option>
            ))}
          </select>
          <span className="text-[10px] sm:text-[11px] text-slate-500 mt-1 block">
            Select the region matching your property for local unit rates.
          </span>
        </div>

        {/* Low Rate Alert Threshold */}
        <div>
          <label className="text-[11px] sm:text-xs font-semibold text-slate-300 flex items-center justify-between mb-1.5">
            <span>Low Rate Alert Threshold</span>
            <span className="font-mono text-emerald-400 font-bold">{threshold}p / kWh</span>
          </label>
          <input
            type="range"
            min="0"
            max="15"
            step="0.5"
            value={threshold}
            onChange={(e) => onChangeThreshold(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] sm:text-[11px] text-slate-500 mt-1">
            <span>0p (Negative)</span>
            <span>5p (Default)</span>
            <span>15p (Off-peak)</span>
          </div>
        </div>
      </div>

      <hr className="my-4 sm:my-6 border-slate-800/80" />

      {/* iOS Safari Home Screen Callout */}
      {iosNeedsInstall && !isPushSubscribed && (
        <div className="mb-4 p-3.5 bg-indigo-950/40 border border-indigo-800/50 rounded-2xl flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-200">
            <strong className="block text-white font-semibold mb-1">
              iPhone / iPad (iOS) Web Push Requirement:
            </strong>
            Apple only allows Web Push notifications when this web app is added to your Home Screen.
            <ol className="list-decimal list-inside space-y-1 mt-1.5 text-indigo-300">
              <li>Tap the Safari <strong>Share button</strong> (<Share2 className="w-3.5 h-3.5 inline mx-0.5" />) at the bottom.</li>
              <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
              <li>Open <strong>Octopus Agile</strong> from your Home Screen to enable Push Notifications.</li>
            </ol>
          </div>
        </div>
      )}

      {/* Push Notification Toggle Section */}
      <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs sm:text-sm font-bold text-white">Browser Push Notifications</h4>
            {isPushSubscribed ? (
              <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Active
              </span>
            ) : (
              <span className="text-[10px] sm:text-[11px] text-slate-500 px-2 py-0.5 rounded-full bg-slate-800">
                Disabled
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-1 max-w-xl">
            Receives OS-level push notifications via your browser or phone when tomorrow has negative
            slots (released ~4 PM) or when a plunge rate starts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <button
            onClick={handleTogglePush}
            disabled={loading}
            className={`flex-1 sm:flex-none px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${isPushSubscribed
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
              }`}
          >
            {isPushSubscribed ? (
              <>
                <BellOff className="w-3.5 h-3.5" /> Disable
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5" /> Enable Push
              </>
            )}
          </button>

          {isPushSubscribed && (
            <button
              onClick={handleSendTest}
              disabled={loading || countdown !== null}
              className={`px-3 py-2 sm:py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${countdown !== null
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
            >
              <Send className="w-3.5 h-3.5" />
              {countdown !== null ? `Lock screen in ${countdown}s...` : 'Test'}
            </button>
          )}
        </div>
      </div>

      {testResult && (
        <div className="mt-3 p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{testResult}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mt-3 p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-semibold block mb-0.5">Notification Setup Note:</span>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}
    </div>
  );
};

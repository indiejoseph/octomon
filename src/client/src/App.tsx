import React, { useEffect, useState } from 'react';
import { RefreshCw, Zap, KeyRound } from 'lucide-react';
import { CurrentRateCard } from './components/CurrentRateCard';
import { RateChart } from './components/RateChart';
import { TomorrowForecast } from './components/TomorrowForecast';
import { NotificationSettings } from './components/NotificationSettings';
import { ApiKeyModal } from './components/ApiKeyModal';
import { getExistingSubscription } from './lib/pushClient';
import { ProcessedRate, DayAnalysis } from './types';

const STORAGE_API_KEY = 'octopus_api_key';
const STORAGE_ACCOUNT = 'octopus_account_number';
const STORAGE_REGION = 'octopus_region';
const STORAGE_THRESHOLD = 'octopus_threshold';

export default function App() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);

  const [rates, setRates] = useState<ProcessedRate[]>([]);
  const [currentSlot, setCurrentSlot] = useState<ProcessedRate | null>(null);
  const [todayAnalysis, setTodayAnalysis] = useState<DayAnalysis | null>(null);
  const [tomorrowAnalysis, setTomorrowAnalysis] = useState<DayAnalysis | null>(null);
  const [region, setRegion] = useState<string>('_C');
  const [threshold, setThreshold] = useState<number>(5.0);
  const [selectedDay, setSelectedDay] = useState<'today' | 'tomorrow'>('today');
  const [loading, setLoading] = useState<boolean>(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);

  useEffect(() => {
    const savedKey = localStorage.getItem(STORAGE_API_KEY);
    const savedAcc = localStorage.getItem(STORAGE_ACCOUNT);
    const savedReg = localStorage.getItem(STORAGE_REGION) || '_C';
    const savedThresh = localStorage.getItem(STORAGE_THRESHOLD);

    if (savedKey) {
      setApiKey(savedKey);
      setShowKeyModal(false);
    } else {
      setShowKeyModal(true);
    }

    if (savedAcc) setAccountNumber(savedAcc);
    if (savedReg) setRegion(savedReg);
    if (savedThresh) setThreshold(parseFloat(savedThresh));

    getExistingSubscription().then((sub) => {
      setIsPushSubscribed(!!sub);
    });
  }, []);

  const loadRates = async (reg: string = region, thresh: number = threshold) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/rates?region=${reg}&threshold=${thresh}`);
      if (!res.ok) throw new Error(`Failed to load rates: ${res.statusText}`);
      const data = await res.json();

      setRates(data.rates || []);
      setCurrentSlot(data.currentSlot || null);
      setTodayAnalysis(data.today || null);
      setTomorrowAnalysis(data.tomorrow || null);
    } catch (err) {
      console.error('Error fetching rates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates(region, threshold);
    const interval = setInterval(() => {
      loadRates(region, threshold);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [region, threshold]);

  const handleSaveApiKey = (key: string, acc?: string, reg?: string) => {
    localStorage.setItem(STORAGE_API_KEY, key);
    setApiKey(key);
    if (acc) {
      localStorage.setItem(STORAGE_ACCOUNT, acc);
      setAccountNumber(acc);
    }
    if (reg) {
      localStorage.setItem(STORAGE_REGION, reg);
      setRegion(reg);
    }
    setShowKeyModal(false);
    loadRates(reg || region, threshold);
  };

  const handleSkipKey = (reg: string) => {
    localStorage.setItem(STORAGE_REGION, reg);
    setRegion(reg);
    setShowKeyModal(false);
    loadRates(reg, threshold);
  };

  const handleRegionChange = (newReg: string) => {
    setRegion(newReg);
    localStorage.setItem(STORAGE_REGION, newReg);
  };

  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    localStorage.setItem(STORAGE_THRESHOLD, String(val));
  };

  const currentIndex = currentSlot
    ? rates.findIndex((r) => r.valid_from === currentSlot.valid_from)
    : -1;
  const previousSlot = currentIndex > 0 ? rates[currentIndex - 1] : null;
  const nextSlot =
    currentIndex >= 0 && currentIndex < rates.length - 1 ? rates[currentIndex + 1] : null;

  const displayedRates =
    selectedDay === 'tomorrow' && tomorrowAnalysis?.rates?.length
      ? tomorrowAnalysis.rates
      : todayAnalysis?.rates || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* First-page API Key Modal */}
      {showKeyModal && (
        <ApiKeyModal onSaveKey={handleSaveApiKey} onSkipWithRegion={handleSkipKey} />
      )}

      {/* Top Navigation - Mobile Optimized */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/apple-touch-icon.png"
              alt="Octopus Energy"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl shadow-md shrink-0 object-cover"
            />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
                <span>Octopus Agile</span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  Edge
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate hidden sm:block">
                Live half-hourly rates, negative plunge alert & web push
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => setShowKeyModal(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Manage API Key"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden xs:inline">{apiKey ? 'Connected' : 'API Key'}</span>
            </button>

            <button
              onClick={() => loadRates(region, threshold)}
              disabled={loading}
              className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Refresh rates"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container - Mobile Responsive Spacing */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {/* Active Slot Card */}
        <CurrentRateCard
          currentSlot={currentSlot}
          previousSlot={previousSlot}
          nextSlot={nextSlot}
        />

        {/* Tomorrow's Forecast & Plunge Alert */}
        {tomorrowAnalysis && <TomorrowForecast analysis={tomorrowAnalysis} />}

        {/* Interactive 48-Slot Rate Curve */}
        <RateChart
          rates={displayedRates}
          threshold={threshold}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          hasTomorrow={Boolean(tomorrowAnalysis?.rates?.length)}
          currentSlot={currentSlot}
        />

        {/* Settings & Web Push Notifications */}
        <NotificationSettings
          currentRegion={region}
          onChangeRegion={handleRegionChange}
          threshold={threshold}
          onChangeThreshold={handleThresholdChange}
          isPushSubscribed={isPushSubscribed}
          onSubscriptionChange={setIsPushSubscribed}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500 px-4">
        <p>
          Powered by Octopus Energy REST API &bull; Cloudflare Workers &bull; Rates update half-hourly
        </p>
      </footer>
    </div>
  );
}

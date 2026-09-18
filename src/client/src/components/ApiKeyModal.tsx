import React, { useState } from 'react';
import { Key, ArrowRight, ShieldCheck, Sparkles, ExternalLink, HelpCircle } from 'lucide-react';
import { DNO_REGIONS } from '../types';

interface ApiKeyModalProps {
  onSaveKey: (apiKey: string, accountNumber?: string, region?: string) => void;
  onSkipWithRegion: (region: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  onSaveKey,
  onSkipWithRegion
}) => {
  const [apiKey, setApiKey] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('_C');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('Please enter your Octopus API Key');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // If user provided an account number, we can verify their account and auto-detect region/tariff
      if (accountNumber.trim()) {
        const authHeader = 'Basic ' + btoa(apiKey.trim() + ':');
        const res = await fetch(`https://api.octopus.energy/v1/accounts/${accountNumber.trim()}/`, {
          headers: { Authorization: authHeader }
        });

        if (res.status === 401 || res.status === 403) {
          throw new Error('Invalid API Key or Account Number. Check your Octopus dashboard.');
        }

        if (res.ok) {
          const accData = await res.json();
          // Try to extract tariff code and region from properties
          const properties = accData.properties || [];
          let detectedRegion = selectedRegion;

          if (properties.length > 0 && properties[0].electricity_meter_points?.length > 0) {
            const mpanObj = properties[0].electricity_meter_points[0];
            const agreements = mpanObj.agreements || [];
            if (agreements.length > 0) {
              const tariff = agreements[agreements.length - 1].tariff_code; // e.g. E-1R-AGILE-24-10-01-C
              const parts = tariff.split('-');
              if (parts.length > 0) {
                const regLetter = parts[parts.length - 1];
                detectedRegion = `_${regLetter}`;
              }
            }
          }
          onSaveKey(apiKey.trim(), accountNumber.trim(), detectedRegion);
          return;
        }
      }

      // If no account number entered, save key directly with selected region
      onSaveKey(apiKey.trim(), undefined, selectedRegion);
    } catch (err: any) {
      setError(err.message || 'Error validating Octopus credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-6">
          <img
            src="/apple-touch-icon.png"
            alt="Octopus Energy"
            className="w-12 h-12 rounded-2xl shadow-lg shadow-emerald-500/10 object-cover"
          />
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Octopus Energy Setup
            </h2>
            <p className="text-xs text-slate-400">
              Enter your Octopus API details to monitor your rates & plunge alerts
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Octopus API Key <span className="text-emerald-400">*</span>
              </label>
              <a
                href="https://octopus.energy/dashboard/developer/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                Find API Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              placeholder="sk_live_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Octopus Account Number <span className="text-slate-500">(Optional)</span>
              </label>
              <span className="text-[11px] text-slate-500">e.g. A-1234ABCD</span>
            </div>
            <input
              type="text"
              placeholder="A-XXXXXXX"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors uppercase font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              If provided, we'll automatically detect your exact DNO region and current tariff.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              DNO Distribution Region
            </label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
            >
              {Object.entries(DNO_REGIONS).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.name} ({item.code}) - {item.area}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{loading ? 'Validating...' : 'Connect & View Rates'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onSkipWithRegion(selectedRegion)}
              className="w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
            >
              Continue without API key (Public rates only)
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Your API key is securely saved in your browser localStorage and only used to query your Agile rates.
          </span>
        </div>
      </div>
    </div>
  );
};


import React from 'react';
import { Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { DayAnalysis } from '../types';

interface TomorrowForecastProps {
  analysis: DayAnalysis;
}

export const TomorrowForecast: React.FC<TomorrowForecastProps> = ({ analysis }) => {
  if (analysis.rates.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-slate-400">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-800/80 text-slate-400 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-300">Tomorrow's Agile Rates</h4>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Not yet published. Released daily around 16:00 UK time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasNegative = analysis.hasNegative;
  const minRate = analysis.minRate?.value_inc_vat.toFixed(2);
  const avgRate = analysis.avgRate.toFixed(2);
  const maxRate = analysis.maxRate?.value_inc_vat.toFixed(2);

  return (
    <div
      className={`rounded-2xl sm:rounded-3xl p-4 sm:p-6 border transition-all ${hasNegative
          ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-900/90 border-emerald-500/40 shadow-xl shadow-emerald-500/5'
          : 'bg-slate-900/60 border-slate-800/80'
        }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl shrink-0 ${hasNegative ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white flex flex-wrap items-center gap-1.5">
              <span>Tomorrow's Summary ({analysis.date})</span>
              {hasNegative && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  NEGATIVE RATES
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-400">
              {hasNegative
                ? `${analysis.negativeSlots.length} slots with negative pricing tomorrow!`
                : 'Rates published and verified.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4 my-3">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 text-center sm:text-left">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 block mb-0.5">Lowest</span>
          <span
            className={`text-lg sm:text-2xl font-bold font-mono ${hasNegative ? 'text-emerald-400' : 'text-slate-200'
              }`}
          >
            {minRate}p
          </span>
          <span className="text-[9px] sm:text-[11px] text-slate-500 block truncate mt-0.5">
            {analysis.minRate?.timeLabel}
          </span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 text-center sm:text-left">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 block mb-0.5">Average</span>
          <span className="text-lg sm:text-2xl font-bold font-mono text-slate-200">{avgRate}p</span>
          <span className="text-[9px] sm:text-[11px] text-slate-500 block mt-0.5">48 slots</span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 text-center sm:text-left">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 block mb-0.5">Peak</span>
          <span className="text-lg sm:text-2xl font-bold font-mono text-amber-400">{maxRate}p</span>
          <span className="text-[9px] sm:text-[11px] text-slate-500 block truncate mt-0.5">
            {analysis.maxRate?.timeLabel}
          </span>
        </div>
      </div>

      {hasNegative && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h5 className="text-[10px] sm:text-xs font-bold text-emerald-300 uppercase tracking-wider">
                Negative Rate Slots:
              </h5>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {analysis.negativeSlots.map((slot) => (
                  <span
                    key={slot.valid_from}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-900/40 border border-emerald-500/30 text-[10px] sm:text-xs font-mono text-emerald-300"
                  >
                    <span>{slot.timeLabel}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-emerald-400" />
                    <strong>{slot.value_inc_vat.toFixed(2)}p</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

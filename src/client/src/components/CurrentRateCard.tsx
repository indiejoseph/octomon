import React, { useEffect, useState } from 'react';
import { Zap, Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { ProcessedRate } from '../types';

interface CurrentRateCardProps {
  currentSlot: ProcessedRate | null;
  previousSlot?: ProcessedRate | null;
  nextSlot?: ProcessedRate | null;
}

export const CurrentRateCard: React.FC<CurrentRateCardProps> = ({
  currentSlot,
  previousSlot,
  nextSlot
}) => {
  const [minutesLeft, setMinutesLeft] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const mins = now.getMinutes();
      const secs = now.getSeconds();
      const remainingMins = (mins >= 30 ? 60 - mins : 30 - mins) - 1;
      const remainingSecs = 59 - secs;
      setMinutesLeft(Math.max(0, remainingMins));
      setSecondsLeft(Math.max(0, remainingSecs));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!currentSlot) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-center animate-pulse">
        <p className="text-xs text-slate-400">Loading current half-hour rate...</p>
      </div>
    );
  }

  const rate = currentSlot.value_inc_vat;
  const isNegative = currentSlot.isNegative;
  const isPeak = currentSlot.isPeak;
  const isCheap = currentSlot.isCheap;

  const diff = previousSlot ? rate - previousSlot.value_inc_vat : null;

  let badgeText = 'Normal Rate';
  let badgeColor = 'bg-slate-800/90 text-slate-300 border-slate-700';
  let cardBorder = 'border-slate-800/80';
  let glowColor = 'from-emerald-500/10 to-transparent';

  if (isNegative) {
    badgeText = '🎉 NEGATIVE PLUNGE';
    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse';
    cardBorder = 'border-emerald-500/50 shadow-lg shadow-emerald-500/10';
    glowColor = 'from-emerald-500/20 via-teal-500/10 to-transparent';
  } else if (isCheap) {
    badgeText = '🟢 CHEAP RATE';
    badgeColor = 'bg-teal-500/20 text-teal-300 border-teal-500/40';
    cardBorder = 'border-teal-500/40';
    glowColor = 'from-teal-500/20 to-transparent';
  } else if (isPeak) {
    badgeText = '⚠️ PEAK (16-19h)';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    cardBorder = 'border-amber-500/40';
    glowColor = 'from-amber-500/15 to-transparent';
  }

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-b ${glowColor} bg-slate-900/80 border ${cardBorder} rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-md transition-all duration-300`}
    >
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl shrink-0 ${isNegative
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : isPeak
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
          >
            <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h3 className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-slate-400">
              Current Slot
            </h3>
            <p className="text-xs sm:text-sm font-mono text-slate-200">
              {currentSlot.timeLabel} - {nextSlot?.timeLabel || 'Next'}
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold border ${badgeColor} tracking-wide shrink-0`}
        >
          {badgeText}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 items-end mt-1">
        <div className="sm:col-span-2">
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <span
              className={`text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-['JetBrains_Mono'] ${isNegative
                  ? 'text-emerald-400'
                  : isPeak
                    ? 'text-amber-400'
                    : 'text-white'
                }`}
            >
              {rate.toFixed(2)}
            </span>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-slate-400">p / kWh</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-slate-400 font-mono">
            <span>Exc. VAT: {currentSlot.value_exc_vat.toFixed(2)}p</span>
            {diff !== null && (
              <span className="flex items-center gap-1 font-semibold">
                {diff > 0 ? (
                  <>
                    <TrendingUp className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-400">+{diff.toFixed(2)}p</span>
                  </>
                ) : diff < 0 ? (
                  <>
                    <TrendingDown className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">{diff.toFixed(2)}p</span>
                  </>
                ) : (
                  <span>0.00p</span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-row sm:flex-col items-center sm:items-stretch justify-between gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] sm:text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> Slot Ends In
            </span>
            {nextSlot && (
              <span className="font-mono text-slate-300 text-[10px] sm:text-xs">
                Next: {nextSlot.value_inc_vat.toFixed(2)}p
              </span>
            )}
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-200">
            {String(minutesLeft).padStart(2, '0')}:{String(secondsLeft).padStart(2, '0')}
          </div>
        </div>
      </div>
    </div>
  );
};

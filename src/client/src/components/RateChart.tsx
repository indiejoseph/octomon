import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell
} from 'recharts';
import { Clock } from 'lucide-react';
import { ProcessedRate } from '../types';

interface RateChartProps {
  rates: ProcessedRate[];
  threshold: number;
  selectedDay: 'today' | 'tomorrow';
  onSelectDay: (day: 'today' | 'tomorrow') => void;
  hasTomorrow: boolean;
  currentSlot?: ProcessedRate | null;
}

export const RateChart: React.FC<RateChartProps> = ({
  rates,
  threshold,
  selectedDay,
  onSelectDay,
  hasTomorrow,
  currentSlot
}) => {
  // Determine if current playhead belongs on the active day view
  const currentSlotTime = selectedDay === 'today' && currentSlot?.timeLabel ? currentSlot.timeLabel : null;

  const chartData = rates.map((r) => ({
    time: r.timeLabel,
    price: r.value_inc_vat,
    isNegative: r.isNegative,
    isPeak: r.isPeak,
    isCheap: r.isCheap,
    validFrom: r.valid_from,
    isCurrent: r.valid_from === currentSlot?.valid_from
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-slate-700 p-2.5 rounded-xl shadow-xl backdrop-blur-md">
          <p className="text-[11px] font-mono text-slate-400 mb-0.5">{data.time}</p>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-lg font-bold font-mono ${data.isNegative
                  ? 'text-emerald-400'
                  : data.isPeak
                    ? 'text-amber-400'
                    : 'text-white'
                }`}
            >
              {data.price.toFixed(2)}p
            </span>
            <span className="text-[10px] text-slate-400">/ kWh</span>
          </div>
          {data.isCurrent && (
            <p className="text-[10px] text-rose-400 font-bold mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3 animate-pulse" /> Current Slot (Now)
            </p>
          )}
          {data.isNegative && (
            <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">
              🎉 Negative (Get paid)
            </p>
          )}
          {data.isPeak && (
            <p className="text-[10px] text-amber-400 font-semibold mt-0.5">
              ⚠️ Peak hours
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 backdrop-blur-sm">
      <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-white">Half-Hourly Pricing Curve</h3>
            {currentSlotTime && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                Playhead: {currentSlotTime}
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400">
            48 half-hour slots (p/kWh inc. VAT)
          </p>
        </div>

        {/* Day Toggle Buttons */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold self-stretch xs:self-auto justify-center">
          <button
            onClick={() => onSelectDay('today')}
            className={`flex-1 xs:flex-none px-3 py-1.5 rounded-lg transition-all text-center ${selectedDay === 'today'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Today
          </button>
          <button
            onClick={() => onSelectDay('tomorrow')}
            disabled={!hasTomorrow}
            className={`flex-1 xs:flex-none px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${selectedDay === 'tomorrow'
                ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
                : hasTomorrow
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
          >
            Tomorrow
            {!hasTomorrow && (
              <span className="text-[9px] opacity-75">(after 4PM)</span>
            )}
          </button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-56 sm:h-64 flex flex-col items-center justify-center text-slate-500 text-xs sm:text-sm text-center px-4">
          <p>No rate data available for this date yet.</p>
          <p className="text-[11px] text-slate-600 mt-1">
            Tomorrow's Agile rates are published daily around 16:00 UK time.
          </p>
        </div>
      ) : (
        <div className="h-60 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
              <XAxis
                dataKey="time"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                interval={5}
                angle={-45}
                textAnchor="end"
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                unit="p"
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
              {threshold > 0 && (
                <ReferenceLine
                  y={threshold}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                />
              )}

              {/* Current Time Playhead Vertical Reference Line */}
              {currentSlotTime && (
                <ReferenceLine
                  x={currentSlotTime}
                  stroke="#f43f5e"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  label={{
                    value: 'NOW',
                    position: 'top',
                    fill: '#f43f5e',
                    fontSize: 9,
                    fontWeight: 'bold'
                  }}
                />
              )}

              <Bar dataKey="price" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, index) => {
                  let fillColor = '#3b82f6';
                  if (entry.isNegative) {
                    fillColor = '#10b981';
                  } else if (entry.price <= threshold) {
                    fillColor = '#06b6d4';
                  } else if (entry.isPeak) {
                    fillColor = '#f59e0b';
                  } else if (entry.price > 30) {
                    fillColor = '#ef4444';
                  }

                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={fillColor}
                      stroke={entry.isCurrent ? '#f43f5e' : undefined}
                      strokeWidth={entry.isCurrent ? 2 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-2 sm:gap-6 mt-3 pt-3 border-t border-slate-800/60 text-[10px] sm:text-xs text-slate-400">
        {currentSlotTime && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-rose-500 rounded-full border border-rose-400 shrink-0" />
            <span className="truncate text-rose-300 font-medium">Current Time (Playhead)</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="truncate">Negative (Paid)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0" />
          <span className="truncate">Cheap (&le; {threshold}p)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
          <span className="truncate">Standard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <span className="truncate">Peak (16-19h)</span>
        </div>
      </div>
    </div>
  );
};

import { OctopusRate, ProcessedRate, DayAnalysis } from './types';

export const DEFAULT_PRODUCT = 'AGILE-24-10-01';

export function getTariffCode(regionCode: string, productCode: string = DEFAULT_PRODUCT): string {
  // Region codes in Octopus tariff codes are formatted like 'E-1R-AGILE-24-10-01-C'
  const letter = regionCode.replace('_', '').toUpperCase();
  return `E-1R-${productCode}-${letter}`;
}

export async function fetchAgileRates(
  regionCode: string = '_C',
  productCode: string = DEFAULT_PRODUCT
): Promise<OctopusRate[]> {
  const tariffCode = getTariffCode(regionCode, productCode);
  const now = new Date();
  
  // Look back 24 hours and forward 36 hours to ensure full coverage of today and tomorrow
  const periodFrom = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  
  const url = `https://api.octopus.energy/v1/products/${productCode}/electricity-tariffs/${tariffCode}/standard-unit-rates/?period_from=${periodFrom}&page_size=150`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Octopus-Agile-Monitor-Worker/1.0',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Octopus API error (${response.status}): ${response.statusText}`);
  }

  const data = (await response.json()) as { results: OctopusRate[] };
  
  // Sort chronologically ascending
  return (data.results || []).sort(
    (a, b) => new Date(a.valid_from).getTime() - new Date(b.valid_to).getTime()
  );
}

export function processRates(rates: OctopusRate[], lowRateThreshold: number = 5.0): ProcessedRate[] {
  return rates.map((r) => {
    const from = new Date(r.valid_from);
    
    // Format to UK local time string (HH:mm)
    const timeLabel = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London',
      hour12: false
    }).format(from);

    const dateLabel = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Europe/London'
    }).format(from);

    const hours = parseInt(timeLabel.split(':')[0], 10);
    const isPeak = hours >= 16 && hours < 19; // 16:00 to 19:00 UK Agile peak

    return {
      ...r,
      isNegative: r.value_inc_vat < 0,
      isCheap: r.value_inc_vat <= lowRateThreshold,
      isPeak,
      timeLabel,
      dateLabel
    };
  });
}

export function getCurrentSlot(processed: ProcessedRate[]): ProcessedRate | null {
  const nowMs = Date.now();
  for (const slot of processed) {
    const fromMs = new Date(slot.valid_from).getTime();
    const toMs = new Date(slot.valid_to).getTime();
    if (nowMs >= fromMs && nowMs < toMs) {
      return slot;
    }
  }
  return null;
}

export function analyzeDayRates(rates: ProcessedRate[], targetDateStr: string): DayAnalysis {
  const dayRates = rates.filter((r) => {
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(r.valid_from));
    return d === targetDateStr;
  });

  if (dayRates.length === 0) {
    return {
      date: targetDateStr,
      rates: [],
      minRate: null,
      maxRate: null,
      avgRate: 0,
      negativeSlots: [],
      hasNegative: false
    };
  }

  let minRate = dayRates[0];
  let maxRate = dayRates[0];
  let sum = 0;
  const negativeSlots: ProcessedRate[] = [];

  for (const r of dayRates) {
    if (r.value_inc_vat < minRate.value_inc_vat) minRate = r;
    if (r.value_inc_vat > maxRate.value_inc_vat) maxRate = r;
    if (r.isNegative) negativeSlots.push(r);
    sum += r.value_inc_vat;
  }

  return {
    date: targetDateStr,
    rates: dayRates,
    minRate,
    maxRate,
    avgRate: Number((sum / dayRates.length).toFixed(2)),
    negativeSlots,
    hasNegative: negativeSlots.length > 0
  };
}

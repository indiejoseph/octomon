export interface Env {
  OCTOPUS_KV: KVNamespace;
  ASSETS?: Fetcher;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export interface OctopusRate {
  value_exc_vat: number;
  value_inc_vat: number;
  valid_from: string; // ISO 8601 UTC
  valid_to: string;   // ISO 8601 UTC
}

export interface ProcessedRate extends OctopusRate {
  isNegative: boolean;
  isCheap: boolean;
  isPeak: boolean;
  timeLabel: string;
  dateLabel: string;
}

export interface DayAnalysis {
  date: string; // YYYY-MM-DD
  rates: ProcessedRate[];
  minRate: ProcessedRate | null;
  maxRate: ProcessedRate | null;
  avgRate: number;
  negativeSlots: ProcessedRate[];
  hasNegative: boolean;
  cheapestWindow?: {
    startTime: string;
    endTime: string;
    avgRate: number;
  };
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface StoredSubscription {
  id: string;
  endpoint: string;
  keys: PushSubscriptionKeys;
  region: string;
  lowRateThreshold: number; // in pence, e.g. 0.0 or 5.0
  notifyTomorrowNegative: boolean;
  notifyCurrentPlunge: boolean;
  createdAt: number;
  lastNotifiedSlot?: string;
  lastNotifiedDate?: string;
}

export interface UserSettings {
  region: string;
  lowRateThreshold: number;
  tariffCode: string;
  productCode: string;
}

export const DNO_REGIONS: Record<string, { code: string; name: string; area: string }> = {
  _A: { code: "_A", name: "Eastern England", area: "East Anglia, Essex, Herts" },
  _B: { code: "_B", name: "East Midlands", area: "Derby, Notts, Leicester" },
  _C: { code: "_C", name: "London", area: "Greater London" },
  _D: { code: "_D", name: "Merseyside & North Wales", area: "Liverpool, Chester, N Wales" },
  _E: { code: "_E", name: "West Midlands", area: "Birmingham, Coventry" },
  _F: { code: "_F", name: "North Eastern England", area: "Newcastle, Durham, Teesside" },
  _G: { code: "_G", name: "North Western England", area: "Manchester, Lancashire, Cumbria" },
  _H: { code: "_H", name: "Southern England", area: "Hampshire, Dorset, Berks, Oxford" },
  _J: { code: "_J", name: "South Eastern England", area: "Kent, Surrey, Sussex" },
  _K: { code: "_K", name: "South Wales", area: "Cardiff, Swansea, Newport" },
  _L: { code: "_L", name: "South Western England", area: "Devon, Cornwall, Bristol, Somerset" },
  _M: { code: "_M", name: "Southern Scotland", area: "Glasgow, Edinburgh" },
  _N: { code: "_N", name: "Northern Scotland", area: "Aberdeen, Highlands, Islands" },
  _P: { code: "_P", name: "North of Scotland (Hydro)", area: "North Coast & Islands" }
};

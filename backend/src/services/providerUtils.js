import { env } from '../config/env.js';

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

export function withSource(value, source) {
  if (Array.isArray(value)) {
    return value.map((item) => ({ ...item, source }));
  }

  return { ...value, source };
}

export function warnFallback(serviceName, error) {
  console.warn(`[${serviceName}] API request failed; using mock fallback. ${error.message}`);
}

export function byStartTime(a, b) {
  return new Date(a.startTime) - new Date(b.startTime);
}

export function getEventStatus(startTime, providerStatus) {
  const normalized = String(providerStatus || '').toLowerCase();

  if (['live', 'in progress', '1h', '2h', 'ht', 'et', 'p', 'q1', 'q2', 'q3'].includes(normalized)) {
    return 'live';
  }

  if (['finished', 'final', 'ft', 'aet', 'pen', 'complete', 'completed'].includes(normalized)) {
    return 'finished';
  }

  return new Date(startTime) < new Date() ? 'finished' : 'upcoming';
}

export function toIstanbulIso(dateInput) {
  const date = new Date(dateInput);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.appTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+03:00`;
}

export function dateKeyInIstanbul(dateInput = new Date()) {
  return toIstanbulIso(dateInput).slice(0, 10);
}

export function addDaysDateKey(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKeyInIstanbul(date);
}

export function isWithinDays(event, days) {
  const start = new Date(event.startTime);
  const now = new Date();
  const limit = new Date();
  limit.setDate(now.getDate() + days);
  return start >= now && start <= limit;
}

export function createMemoryCache(ttlMs = 5 * 60 * 1000) {
  let cachedValue = null;
  let cachedAt = 0;
  let inFlight = null;

  return async function cached(loader) {
    const now = Date.now();

    if (cachedValue && now - cachedAt < ttlMs) {
      return cachedValue;
    }

    if (!inFlight) {
      inFlight = loader()
        .then((value) => {
          cachedValue = value;
          cachedAt = Date.now();
          return value;
        })
        .finally(() => {
          inFlight = null;
        });
    }

    return inFlight;
  };
}

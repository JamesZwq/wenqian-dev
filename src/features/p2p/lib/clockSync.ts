export interface ClockSyncEstimate {
  offsetMs: number;
  rttMs: number;
  jitterMs: number;
  sampleCount: number;
}

export interface ClockSyncSample {
  offsetMs: number;
  rttMs: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createClockSyncSample(
  sentAtLocalMs: number,
  receivedAtLocalMs: number,
  responderNowMs: number,
): ClockSyncSample {
  const rttMs = Math.max(0, receivedAtLocalMs - sentAtLocalMs);
  const midpointMs = sentAtLocalMs + (rttMs / 2);

  return {
    rttMs,
    offsetMs: responderNowMs - midpointMs,
  };
}

export function mergeClockSyncEstimate(
  current: ClockSyncEstimate | null,
  sample: ClockSyncSample,
): ClockSyncEstimate {
  if (!current) {
    return {
      offsetMs: sample.offsetMs,
      rttMs: sample.rttMs,
      jitterMs: 0,
      sampleCount: 1,
    };
  }

  const betterPath = sample.rttMs <= current.rttMs;
  const offsetWeight = betterPath ? 0.45 : 0.2;
  const rttWeight = betterPath ? 0.35 : 0.15;
  const jitterMs = Math.abs(sample.offsetMs - current.offsetMs);

  return {
    offsetMs: current.offsetMs + ((sample.offsetMs - current.offsetMs) * offsetWeight),
    rttMs: current.rttMs + ((sample.rttMs - current.rttMs) * rttWeight),
    jitterMs: current.jitterMs + ((jitterMs - current.jitterMs) * 0.3),
    sampleCount: current.sampleCount + 1,
  };
}

export function estimatePeerClockMs(offsetMs: number | null, localNowMs = Date.now()): number {
  return localNowMs + (offsetMs ?? 0);
}

export function getLagCompensationWindowMs(
  rttMs: number | null,
  jitterMs: number | null,
): number {
  const oneWayMs = (rttMs ?? 120) / 2;
  const jitterBudgetMs = jitterMs ?? 18;

  return clamp(Math.round(oneWayMs + jitterBudgetMs + 24), 80, 220);
}


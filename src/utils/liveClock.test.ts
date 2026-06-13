import { describe, it, expect } from 'vitest';
import { liveClockLabel, LIVE_CLOCK_CAP_MS } from './liveClock';

// Locks the three regressions that actually shipped this season.
describe('liveClockLabel', () => {
  it('centres the minute with the +30s bias (fresh capture)', () => {
    // minute just observed (ext = 0) → 65:30, not 65:00
    expect(liveClockLabel(65, 1_000_000, 1_000_000)).toBe('65:30');
  });

  it('zero-pads the seconds', () => {
    // minute=70, ext=0 → 70*60+30 = 4230s = 70:30; pick a case with <10 secs
    expect(liveClockLabel(70, 1_000_000, 1_000_000 + 25_000)).toBe('70:55');
    expect(liveClockLabel(70, 1_000_000, 1_000_000 + 31_000)).toBe('71:01');
  });

  it('ticks forward in real time as `now` advances', () => {
    const a = liveClockLabel(65, 1_000_000, 1_000_000 + 5_000);
    const b = liveClockLabel(65, 1_000_000, 1_000_000 + 65_000);
    expect(a).toBe('65:35');
    expect(b).toBe('66:35');
  });

  it('NEVER goes backwards while the minute plateaus (stoppage time)', () => {
    // minute stuck at 90, anchor fixed — the displayed seconds must only increase.
    const base = 5_000_000;
    let prev = -1;
    for (let dt = 0; dt <= 5 * 60_000; dt += 7_000) {
      const label = liveClockLabel(90, base, base + dt);
      const total = Number(label.split(':')[0]) * 60 + Number(label.split(':')[1]);
      expect(total).toBeGreaterThanOrEqual(prev);
      prev = total;
    }
  });

  it('caps extrapolation so a stalled poller cannot run the clock away', () => {
    const base = 5_000_000;
    const atCap = liveClockLabel(90, base, base + LIVE_CLOCK_CAP_MS);
    const wayPast = liveClockLabel(90, base, base + LIVE_CLOCK_CAP_MS + 60 * 60_000);
    expect(atCap).toBe(wayPast); // frozen at the cap, not climbing to 150:00+
    expect(atCap).toBe('105:30'); // 90*60 + 900 + 30 = 6330s
  });

  it('treats a future/negative anchor as zero elapsed (no negative clock)', () => {
    expect(liveClockLabel(10, 2_000_000, 1_000_000)).toBe('10:30');
  });
});

import { describe, it, expect } from 'vitest';
import {
  channelsToSourceExpr,
  parseLiveFootballOnTvWorldCupHtml,
  parseUkTvScheduleSource,
  renderUkTvScheduleSource,
  ukTvScheduleKey,
} from './ukTvScheduleLib.mjs';

describe('ukTvScheduleLib: parseLiveFootballOnTvWorldCupHtml', () => {
  it('extracts resolved fixtures and normalises BBC Sport Website', () => {
    const html = `
      <div class="fixture">
        <div class="fixture__time">19:00</div>
        <div class="fixture__teams">Australia v Egypt</div>
        <div class="fixture__competition">FIFA World Cup 2026&nbsp;Round of 32</div>
        <div class="fixture__channel"><div class="span3 channels">
          <span class="channel-pill">BBC One</span>
          <span class="channel-pill">BBC iPlayer</span>
          <span class="channel-pill">BBC Sport Website</span>
        </div></div>
      </div>
      <div class="fixture">
        <div class="fixture__time">17:00</div>
        <div class="fixture__teams">TBC</div>
        <div class="fixture__competition">FIFA World Cup 2026&nbsp;Round of 16</div>
        <div class="fixture__channel"><div class="span3 channels">
          <span class="channel-pill">ITV1</span>
        </div></div>
      </div>
    `;
    expect(parseLiveFootballOnTvWorldCupHtml(html)).toEqual({
      [ukTvScheduleKey('Australia', 'Egypt')]: ['BBC One', 'BBC iPlayer', 'BBC Sport'],
    });
  });
});

describe('ukTvScheduleLib: source rendering', () => {
  it('parses existing entries and renders merged source with channel presets', () => {
    const source = `
      export const UK_TV_SCHEDULE: Record<string, readonly string[]> = {
        'mexico_vs_south-africa': C.I1,
      };
    `;
    const entries = parseUkTvScheduleSource(source);
    entries.set('australia_vs_egypt', channelsToSourceExpr(['BBC One', 'BBC iPlayer', 'BBC Sport Website']));
    const rendered = renderUkTvScheduleSource(entries);
    expect(rendered).toContain(`'mexico_vs_south-africa': C.I1,`);
    expect(rendered).toContain(`'australia_vs_egypt': C.B1,`);
  });
});

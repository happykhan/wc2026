import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from './scores.js';

function responseRecorder() {
  const headers = new Map<string, string>();
  let statusCode: number | undefined;
  let body: unknown;

  const response = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return response;
    },
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(value: unknown) {
      body = value;
      return response;
    },
  };

  return {
    response,
    result: () => ({ headers, statusCode, body }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('/api/scores', () => {
  it('serves the complete final snapshot without a network request', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const recorder = responseRecorder();

    handler({} as never, recorder.response as never);

    const { headers, statusCode, body } = recorder.result();
    const data = body as {
      live: boolean;
      matches: Array<{
        status: string;
        score: { fullTime: { home: number | null; away: number | null } };
      }>;
    };

    expect(fetchMock).not.toHaveBeenCalled();
    expect(statusCode).toBe(200);
    expect(headers.get('Cache-Control')).toContain('s-maxage=86400');
    expect(data.live).toBe(false);
    expect(data.matches).toHaveLength(104);
    expect(data.matches.every((match) => match.status === 'FINISHED')).toBe(true);
    expect(data.matches.every((match) =>
      match.score.fullTime.home !== null && match.score.fullTime.away !== null,
    )).toBe(true);
  });
});

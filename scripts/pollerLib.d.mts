// Type declarations for the raw-node poller helpers, so the parity test (and any
// future TS consumer) type-checks the .mjs import.
export const TEAM_ALIASES: Record<string, string>;
export function norm(s: string | null | undefined): string;
export function pairKey(a: string | null | undefined, b: string | null | undefined): string;
export function hasScore(s: { fullTime?: { home: number | null; away: number | null } } | null | undefined): boolean;
export function espnStatus(ev: { status?: { type?: { state?: string; name?: string; completed?: boolean } } }): 'FINISHED' | 'PAUSED' | 'IN_PLAY' | null;
export function espnMinute(ev: { status?: { displayClock?: string } }): number | null;
export function espnDateStrings(kickoffMs: number): string[];

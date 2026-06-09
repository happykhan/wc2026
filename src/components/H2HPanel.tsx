import { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// H2HPanel
//
// Displays head-to-head match history between two teams using the
// API-Football /fixtures/headtohead endpoint (proxied via /api/afl/fixtures/headtohead).
//
// Note: the API-Football free plan does not support the "last" query
// parameter — it returns all historical H2H fixtures instead. Results are
// sliced client-side to the most recent 10.
//
// Falls back gracefully if either team lacks an AFL team ID.
// ---------------------------------------------------------------------------

interface H2HFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: { name: string; season: number };
  teams: {
    home: { id: number; name: string; winner: boolean | null };
    away: { id: number; name: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
}

interface H2HPanelProps {
  team1Name: string;
  team2Name: string;
  aflTeam1Id: number | null;
  aflTeam2Id: number | null;
}

function formatDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(isoDate));
  } catch {
    return isoDate.slice(0, 10);
  }
}

function MatchResult({
  fixture,
  team1Name,
}: {
  fixture: H2HFixture;
  team1Name: string;
}) {
  const home = fixture.teams.home.name;
  const away = fixture.teams.away.name;
  const homeGoals = fixture.goals.home ?? 0;
  const awayGoals = fixture.goals.away ?? 0;

  // Determine outcome relative to team1
  const team1IsHome = home.toLowerCase().includes(team1Name.toLowerCase().split(' ')[0]);
  const team1Goals = team1IsHome ? homeGoals : awayGoals;
  const team2Goals = team1IsHome ? awayGoals : homeGoals;

  let resultColour = 'text-neutral-500 dark:text-neutral-400';
  if (team1Goals > team2Goals) resultColour = 'text-emerald-600 dark:text-emerald-400';
  if (team1Goals < team2Goals) resultColour = 'text-red-600 dark:text-red-400';

  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      <span className="text-neutral-400 dark:text-neutral-500 w-24 shrink-0 text-xs">
        {formatDate(fixture.fixture.date)}
      </span>
      <span className="flex-1 truncate text-neutral-700 dark:text-neutral-300">
        {home} <span className="text-neutral-400">vs</span> {away}
      </span>
      <span className={`font-mono font-semibold tabular-nums ${resultColour}`}>
        {homeGoals}–{awayGoals}
      </span>
      <span className="text-neutral-400 dark:text-neutral-500 text-xs w-16 text-right shrink-0 truncate">
        {fixture.league.name}
      </span>
    </li>
  );
}

export function H2HPanel({ team1Name, team2Name, aflTeam1Id, aflTeam2Id }: H2HPanelProps) {
  const [fixtures, setFixtures] = useState<H2HFixture[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!aflTeam1Id || !aflTeam2Id) {
      setError('Head-to-head data not available for this fixture.');
      return;
    }

    const cacheKey = `h2h-${Math.min(aflTeam1Id, aflTeam2Id)}-${Math.max(aflTeam1Id, aflTeam2Id)}`;

    // Check localStorage cache (H2H results are immutable for past matches).
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setFixtures(JSON.parse(cached) as H2HFixture[]);
        return;
      }
    } catch {
      // Ignore storage errors.
    }

    setLoading(true);
    setError(null);

    async function load() {
      // Note: "last" param is blocked on free plan — we receive all H2H fixtures
      // and slice to the 10 most recent client-side.
      const res = await fetch(
        `/api/afl/fixtures/headtohead?h2h=${aflTeam1Id}-${aflTeam2Id}`
      );

      if (!res.ok) {
        setError('Could not load head-to-head data.');
        setLoading(false);
        return;
      }

      const data = await res.json();
      const all: H2HFixture[] = data.response ?? [];

      // Most recent 10, sorted newest first.
      const recent = all
        .filter((f) => f.fixture.status.short === 'FT')
        .sort((a, b) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime())
        .slice(0, 10);

      if (recent.length > 0) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(recent));
        } catch {
          // Ignore quota errors.
        }
      }

      setFixtures(recent);
      setLoading(false);
    }

    void load().catch(() => {
      setError('Could not load head-to-head data.');
      setLoading(false);
    });
  }, [aflTeam1Id, aflTeam2Id]);

  if (!aflTeam1Id || !aflTeam2Id) {
    return (
      <div className="text-sm text-neutral-400 dark:text-neutral-500 py-4 text-center">
        Head-to-head history not available for this fixture.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-sm text-neutral-400 dark:text-neutral-500 py-4 text-center animate-pulse">
        Loading head-to-head history…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 dark:text-red-400 py-4 text-center">
        {error}
      </div>
    );
  }

  if (!fixtures || fixtures.length === 0) {
    return (
      <div className="text-sm text-neutral-400 dark:text-neutral-500 py-4 text-center">
        No previous meetings found between {team1Name} and {team2Name}.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
        Recent meetings — {team1Name} vs {team2Name}
      </h3>
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {fixtures.map((f) => (
          <MatchResult key={f.fixture.id} fixture={f} team1Name={team1Name} />
        ))}
      </ul>
    </div>
  );
}

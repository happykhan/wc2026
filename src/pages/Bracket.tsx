import { useEffect, useMemo, useState } from 'react';
import type { Match, UserPreferences } from '../types';
import { GitBranch, List, Network, Route, TriangleAlert, X } from 'lucide-react';
import type { TranslationKey } from '../data/i18n';
import { buildBracket, type BracketMatch, type BracketRound } from '../data/bracket';
import { getTeamFlag } from '../data/teamFlags';
import { isKnockoutTeam } from '../data/processFixtures';
import { formatMatchDate, formatMatchTime } from '../utils/time';
import { FeatureNoticeGroup } from '../components/FeatureNotice';

interface BracketProps {
  matches: Match[];
  prefs: UserPreferences;
  t: (k: TranslationKey) => string;
}

type BracketView = 'tree' | 'rounds';

interface PathSelection {
  matchId: string;
  side: 1 | 2;
}

interface PathStep {
  match: BracketMatch;
  focusSide: 1 | 2;
}

const VIEW_STORAGE_KEY = 'wc2026-bracket-view';

function readStoredView(): BracketView {
  if (typeof window === 'undefined') return 'rounds';
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
  if (stored === 'tree' || stored === 'rounds') return stored;
  return window.matchMedia('(min-width: 768px)').matches ? 'tree' : 'rounds';
}

function TeamLine({
  label,
  resolved,
  score,
  isWinner,
  onOpenPath,
}: {
  label: string;
  resolved: boolean;
  score?: number;
  isWinner: boolean;
  onOpenPath?: () => void;
}) {
  const flag = resolved && !isKnockoutTeam(label) ? getTeamFlag(label) : null;
  const className = [
    'group grid min-w-0 w-full items-center gap-x-1.5 px-2 py-1 text-left',
    onOpenPath
      ? (score !== undefined
          ? 'grid-cols-[auto_minmax(0,1fr)_2.25rem_auto] hover:bg-neutral-50 dark:hover:bg-neutral-800/70'
          : 'grid-cols-[auto_minmax(0,1fr)_auto] hover:bg-neutral-50 dark:hover:bg-neutral-800/70')
      : (score !== undefined
          ? 'grid-cols-[auto_minmax(0,1fr)_2.25rem]'
          : 'grid-cols-[auto_minmax(0,1fr)]'),
    isWinner ? 'font-semibold text-neutral-900 dark:text-neutral-100' : '',
    !resolved ? 'text-neutral-400 dark:text-neutral-500 italic' : 'text-neutral-700 dark:text-neutral-300',
  ].join(' ');
  const content = (
    <>
      {flag && <span aria-hidden="true" className="flex-shrink-0">{flag}</span>}
      <span className="min-w-0 truncate text-xs">{label}</span>
      {score !== undefined && (
        <span className="w-9 text-right tabular-nums font-mono text-xs text-neutral-800 dark:text-neutral-200">
          {score}
        </span>
      )}
      {onOpenPath && (
        <Route
          size={12}
          aria-hidden="true"
          className="flex-shrink-0 text-neutral-400 group-hover:text-blue-500 dark:text-neutral-500 dark:group-hover:text-blue-300"
        />
      )}
    </>
  );

  if (onOpenPath) {
    return (
      <button
        type="button"
        className={className}
        onClick={onOpenPath}
        aria-label={`Show path for ${label}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={className}
    >
      {content}
    </div>
  );
}

function BracketCard({
  m,
  prefs,
  t,
  layout = 'tree',
  onOpenPath,
}: {
  m: BracketMatch;
  prefs: UserPreferences;
  t: (k: TranslationKey) => string;
  layout?: BracketView;
  onOpenPath?: (selection: PathSelection) => void;
}) {
  const live = m.status === 'live' || m.status === 'ht';
  const date = formatMatchDate(m.utcDate, prefs.timezone, prefs.language).replace(/,.*$/, '');
  const time = formatMatchTime(m.utcDate, prefs.timezone, prefs.hour12);
  return (
    <div
      className={[
        'rounded-lg border bg-white dark:bg-neutral-900 flex-shrink-0',
        layout === 'rounds' ? 'w-full' : 'w-44',
        live
          ? 'border-red-400 dark:border-red-500'
          : 'border-neutral-200 dark:border-neutral-700',
      ].join(' ')}
    >
      <div className="px-2 pt-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          {m.num ? `#${m.num}` : ''} {date} {time}
        </span>
        {m.projected && (
          <span
            className="ml-1 inline-flex items-center text-amber-500 dark:text-amber-300"
            title={t('asItStands')}
            aria-label={t('asItStands')}
          >
            <TriangleAlert size={11} strokeWidth={2.25} />
          </span>
        )}
        {live && <span className="text-[10px] font-semibold text-red-500">LIVE</span>}
        {m.status === 'ft' && <span className="text-[10px] text-neutral-400">FT</span>}
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        <TeamLine
          label={m.team1.label}
          resolved={m.team1.resolved}
          score={m.score1}
          isWinner={m.winner === 1}
          onOpenPath={onOpenPath ? () => onOpenPath({ matchId: m.matchId, side: 1 }) : undefined}
        />
        <TeamLine
          label={m.team2.label}
          resolved={m.team2.resolved}
          score={m.score2}
          isWinner={m.winner === 2}
          onOpenPath={onOpenPath ? () => onOpenPath({ matchId: m.matchId, side: 2 }) : undefined}
        />
      </div>
    </div>
  );
}

function ViewSwitch({ view, setView }: { view: BracketView; setView: (view: BracketView) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setView('rounds')}
        className={[
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold',
          view === 'rounds'
            ? 'bg-blue-600 text-white'
            : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
        ].join(' ')}
      >
        <List size={14} />
        Rounds
      </button>
      <button
        type="button"
        onClick={() => setView('tree')}
        className={[
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold',
          view === 'tree'
            ? 'bg-blue-600 text-white'
            : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
        ].join(' ')}
      >
        <Network size={14} />
        Tree
      </button>
    </div>
  );
}

function RoundTabs({
  rounds,
  activeRound,
  setActiveRound,
}: {
  rounds: BracketRound[];
  activeRound: string;
  setActiveRound: (key: string) => void;
}) {
  const shortTitle = (round: BracketRound) => {
    if (round.key === 'r32') return 'R32';
    if (round.key === 'r16') return 'R16';
    if (round.key === 'qf') return 'QF';
    if (round.key === 'sf') return 'SF';
    if (round.key === 'third') return '3rd';
    return 'Final';
  };

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="inline-flex min-w-max rounded-lg border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
        {rounds.map((round) => (
          <button
            key={round.key}
            type="button"
            onClick={() => setActiveRound(round.key)}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-semibold',
              activeRound === round.key
                ? 'bg-blue-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
            ].join(' ')}
          >
            {shortTitle(round)}
          </button>
        ))}
      </div>
    </div>
  );
}

function buildPathSteps(rounds: BracketRound[], selection: PathSelection | null): PathStep[] {
  if (!selection) return [];
  const allMatches = rounds.flatMap((round) => round.matches);
  const start = allMatches.find((m) => m.matchId === selection.matchId);
  if (!start) return [];

  const steps: PathStep[] = [{ match: start, focusSide: selection.side }];
  let current = start;
  let guard = 0;
  while (current.num !== undefined && guard < 8) {
    const winnerSlot = `W${current.num}`;
    const next = allMatches.find((candidate) =>
      candidate.sourceTeam1 === winnerSlot || candidate.sourceTeam2 === winnerSlot
    );
    if (!next) break;
    steps.push({
      match: next,
      focusSide: next.sourceTeam1 === winnerSlot ? 1 : 2,
    });
    current = next;
    guard += 1;
  }
  return steps;
}

function PathPanel({
  rounds,
  selection,
  prefs,
  onClose,
}: {
  rounds: BracketRound[];
  selection: PathSelection | null;
  prefs: UserPreferences;
  onClose: () => void;
}) {
  const steps = useMemo(() => buildPathSteps(rounds, selection), [rounds, selection]);
  if (!selection || steps.length === 0) return null;

  const start = steps[0].match;
  const selectedTeam = selection.side === 1 ? start.team1.label : start.team2.label;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-3 pt-16 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <GitBranch size={16} className="text-blue-600 dark:text-blue-300" />
              <span className="truncate">{selectedTeam} path</span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              Assumes this side keeps advancing
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            aria-label="Close path view"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          <div className="space-y-3">
            {steps.map((step, index) => {
              const focus = step.focusSide === 1 ? step.match.team1 : step.match.team2;
              const other = step.focusSide === 1 ? step.match.team2 : step.match.team1;
              const date = formatMatchDate(step.match.utcDate, prefs.timezone, prefs.language).replace(/,.*$/, '');
              const time = formatMatchTime(step.match.utcDate, prefs.timezone, prefs.hour12);
              return (
                <div key={`${step.match.matchId}-${index}`} className="relative pl-5">
                  {index < steps.length - 1 && (
                    <span className="absolute left-[7px] top-7 h-[calc(100%+0.75rem)] w-px bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  <span className="absolute left-0 top-5 h-3.5 w-3.5 rounded-full border-2 border-blue-600 bg-white dark:bg-neutral-950" />
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        {step.match.num ? `#${step.match.num}` : ''} {step.match.round}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                        {date} {time}
                      </span>
                    </div>
                    <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      <TeamLine
                        label={focus.label}
                        resolved={focus.resolved}
                        score={step.focusSide === 1 ? step.match.score1 : step.match.score2}
                        isWinner={step.match.winner === step.focusSide}
                      />
                      <TeamLine
                        label={other.label}
                        resolved={other.resolved}
                        score={step.focusSide === 1 ? step.match.score2 : step.match.score1}
                        isWinner={step.match.winner === (step.focusSide === 1 ? 2 : 1)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Bracket({ matches, prefs, t }: BracketProps) {
  const rounds = useMemo(() => buildBracket(matches), [matches]);
  const [view, setViewState] = useState<BracketView>(() => readStoredView());
  const [activeRound, setActiveRound] = useState<string>(rounds[0]?.key ?? 'r32');
  const [pathSelection, setPathSelection] = useState<PathSelection | null>(null);

  const setView = (next: BracketView) => {
    setViewState(next);
    if (typeof window !== 'undefined') window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  useEffect(() => {
    if (rounds.length > 0 && !rounds.some((round) => round.key === activeRound)) {
      setActiveRound(rounds[0].key);
    }
  }, [activeRound, rounds]);

  const selectedRound = rounds.find((round) => round.key === activeRound) ?? rounds[0];

  if (rounds.length === 0) {
    return (
      <div className="py-16 text-center text-neutral-400 dark:text-neutral-500 text-sm">
        {t('bracketEmpty')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <ViewSwitch view={view} setView={setView} />
      </div>

      {view === 'rounds' && selectedRound && (
        <div className="space-y-3">
          <RoundTabs rounds={rounds} activeRound={selectedRound.key} setActiveRound={setActiveRound} />
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide px-1">
              {selectedRound.title}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedRound.matches.map((m, i) => (
                <BracketCard
                  key={m.matchId + i}
                  m={m}
                  prefs={prefs}
                  t={t}
                  layout="rounds"
                  onOpenPath={setPathSelection}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'tree' && (
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-3 md:gap-5 min-w-max">
            {rounds.map((round) => (
              <div key={round.key} className="flex flex-col">
                <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2 px-1 whitespace-nowrap">
                  {round.title}
                </h3>
                <div
                  className={[
                    'flex flex-col justify-around flex-1',
                    round.key === 'r32' ? 'gap-2' : round.key === 'r16' ? 'gap-4' : 'gap-6',
                  ].join(' ')}
                >
                  {round.matches.map((m, i) => (
                    <BracketCard
                      key={m.matchId + i}
                      m={m}
                      prefs={prefs}
                      t={t}
                      onOpenPath={setPathSelection}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <PathPanel
        rounds={rounds}
        selection={pathSelection}
        prefs={prefs}
        onClose={() => setPathSelection(null)}
      />

      <FeatureNoticeGroup
        dismissLabel={t('scheduleFeatureDismiss')}
        notices={[
          {
            id: 'bracket-views-v1',
            title: t('bracketFeatureTitle'),
            children: t('bracketFeatureBody'),
          },
          {
            id: 'bracket-path-v1',
            title: t('pathFeatureTitle'),
            children: t('pathFeatureBody'),
          },
        ]}
      />
    </div>
  );
}

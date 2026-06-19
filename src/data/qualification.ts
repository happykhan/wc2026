export type QualificationState = 'qualified';

// Manual qualification states for teams whose knockout place is secure before
// their exact group position is settled.
const QUALIFICATION_BY_TEAM: Record<string, QualificationState> = {
  Mexico: 'qualified',
};

export function getQualificationState(team: string): QualificationState | undefined {
  return QUALIFICATION_BY_TEAM[team];
}


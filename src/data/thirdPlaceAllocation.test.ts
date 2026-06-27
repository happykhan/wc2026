import { describe, expect, it } from 'vitest';
import {
  THIRD_PLACE_ASSIGNMENTS,
  getThirdPlaceAssignment,
  isThirdPlaceAssignmentStable,
} from './thirdPlaceAllocation';

describe('third-place allocation table', () => {
  it('contains only assignments from advancing third-placed groups', () => {
    for (const [key, assignment] of Object.entries(THIRD_PLACE_ASSIGNMENTS)) {
      expect(key).toHaveLength(8);
      expect(new Set(key).size).toBe(8);

      for (const slot of Object.values(assignment)) {
        expect(slot).toMatch(/^3[A-L]$/);
        expect(key).toContain(slot.slice(1));
      }
    }
  });

  it('maps the current ABDEFGIL row to the reported Round-of-32 fixtures', () => {
    const assignment = getThirdPlaceAssignment(['A', 'B', 'D', 'E', 'F', 'G', 'I', 'L']);

    expect(assignment?.['1E']).toBe('3D');
    expect(assignment?.['1A']).toBe('3E');
    expect(assignment?.['1G']).toBe('3A');
    expect(assignment?.['1L']).toBe('3I');
  });

  it('detects whether an allocated slot is stable across remaining possible rows', () => {
    expect(isThirdPlaceAssignmentStable('1E', '3D')).toBe(true);
    expect(isThirdPlaceAssignmentStable('1A', '3E')).toBe(false);
  });
});

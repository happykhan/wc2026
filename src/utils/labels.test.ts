import { describe, it, expect } from 'vitest';
import { localizedGroupName } from './labels';

describe('localizedGroupName', () => {
  it('translates the word while keeping the letter', () => {
    expect(localizedGroupName('Group A', 'Grupo')).toBe('Grupo A');
    expect(localizedGroupName('Group L', 'Groupe')).toBe('Groupe L');
    expect(localizedGroupName('Group A', 'Gruppe')).toBe('Gruppe A');
  });

  it('leaves the English word unchanged when groupWord is "Group"', () => {
    expect(localizedGroupName('Group C', 'Group')).toBe('Group C');
  });

  it('passes through non-group labels (e.g. knockout rounds) untouched', () => {
    expect(localizedGroupName('Round of 16', 'Grupo')).toBe('Round of 16');
  });

  it('handles null/empty safely', () => {
    expect(localizedGroupName(null, 'Grupo')).toBe('');
    expect(localizedGroupName('', 'Grupo')).toBe('');
  });
});

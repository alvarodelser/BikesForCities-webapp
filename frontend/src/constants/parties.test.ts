// frontend/src/constants/parties.test.ts
import { describe, it, expect } from 'vitest';
import { getPartyColor, getPartyIdeology, PARTY_COLORS } from './parties';

const GRAY = '#9ca3af';

describe('getPartyColor', () => {
  it('resolves exact display names (existing behaviour)', () => {
    expect(getPartyColor('PP')).toBe(PARTY_COLORS['PP']);
    expect(getPartyColor('Vox')).toBe(PARTY_COLORS['Vox']);
  });

  it('is case-insensitive (ballot names come uppercased from MIR data)', () => {
    expect(getPartyColor('VOX')).toBe(PARTY_COLORS['Vox']);
    expect(getPartyColor('CS')).toBe(PARTY_COLORS['Cs']);
  });

  it('resolves official ballot abbreviations seen in city_elections', () => {
    expect(getPartyColor('MM-VQ')).toBe(PARTY_COLORS['Más Madrid']);
    expect(getPartyColor('PSC-CP')).toBe(PARTY_COLORS['PSC']);
    expect(getPartyColor('PSOE-A')).toBe(PARTY_COLORS['PSOE']);
    expect(getPartyColor('BARCELONA EN COMÚ - C')).toBe(PARTY_COLORS['Barcelona en comú']);
    expect(getPartyColor('ERC - AM')).toBe(PARTY_COLORS['ERC']);
    expect(getPartyColor('PODEMOS-IU-AV')).toBe(PARTY_COLORS['Podemos']);
    expect(getPartyColor('UNIDAS - IU - PODEMOS')).toBe(PARTY_COLORS['Podemos']);
    expect(getPartyColor('TRIASXBCN-CM')).toBe(PARTY_COLORS['JxCat']);
    expect(getPartyColor('GGI-AMUNT')).toBe(PARTY_COLORS['Guanyem Girona']);
  });

  it('falls back to family patterns for unseen coalition names', () => {
    expect(getPartyColor('PSOE DE OTRA CIUDAD')).toBe(PARTY_COLORS['PSOE']);
    expect(getPartyColor('EH BILDU')).toBe(PARTY_COLORS['EH Bildu']);
    expect(getPartyColor('EAJ-PNV')).toBe(PARTY_COLORS['PNV']);
    expect(getPartyColor('BNG-ASAMBLEAS ABERTAS')).toBe(PARTY_COLORS['BNG']);
    expect(getPartyColor('COMPROMÍS PER VALÈNCIA')).toBe(PARTY_COLORS['Compromís']);
  });

  it('does not misfire patterns on unrelated names', () => {
    expect(getPartyColor('PACMA')).toBe(GRAY);
    expect(getPartyColor('ULEG')).toBe(GRAY);
    expect(getPartyColor('ESCAÑOS EN BLANCO')).toBe(GRAY);
  });

  it('returns gray for unknown or empty parties', () => {
    expect(getPartyColor('PARTIDO INEXISTENTE XYZ')).toBe(GRAY);
    expect(getPartyColor(null)).toBe(GRAY);
    expect(getPartyColor(undefined)).toBe(GRAY);
  });
});

describe('getPartyIdeology', () => {
  it('orders left → right: left-wing < PSOE < PP < Vox', () => {
    expect(getPartyIdeology('PODEMOS-IU-AV')).toBeLessThan(getPartyIdeology('PSOE-A'));
    expect(getPartyIdeology('PSOE-A')).toBeLessThan(getPartyIdeology('PP'));
    expect(getPartyIdeology('PP')).toBeLessThan(getPartyIdeology('VOX'));
  });

  it('resolves ballot abbreviations like display names', () => {
    expect(getPartyIdeology('MM-VQ')).toBe(getPartyIdeology('Más Madrid'));
    expect(getPartyIdeology('PSC-CP')).toBe(getPartyIdeology('PSOE'));
  });

  it('places regionalist parties in the center', () => {
    expect(getPartyIdeology('EAJ-PNV')).toBe(50);
  });

  it('defaults unknown parties to the center (50)', () => {
    expect(getPartyIdeology('PACMA')).toBe(50);
    expect(getPartyIdeology(null)).toBe(50);
  });
});

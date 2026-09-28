export const PARTIES = {
  lab: { name: 'Labour', color: '#e64661' },
  con: { name: 'Conservative', color: '#3186c9' },
  ld: { name: 'Liberal Democrat', color: '#efa62d' },
  snp: { name: 'SNP', color: '#eed74c' },
  ref: { name: 'Reform UK', color: '#32b8c0' },
  grn: { name: 'Green', color: '#58a55c' },
  pc: { name: 'Plaid Cymru', color: '#23745b' },
  oth: { name: 'Other', color: '#8d9aa1' },
} as const;

export type Party = keyof typeof PARTIES;
export type Vote = [Party, number, number, number];
export interface Ward {
  id: string;
  name: string;
  pcon: string;
  region: string;
  leader: Party | 'tie';
  votes: Vote[];
}
export interface Estimates { source: string; download: string; wards: Ward[] }
export interface Selection { id: string; focus: boolean; sequence: number }
export const DEFAULT_WARD = 'E05000650';
export const percentage = (value: number) => `${(value * 100).toFixed(1)}%`;
export const normalise = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Council qualifiers disambiguate search results, but duplicate the map context
// in the heading. Retain census part names: these identify distinct areas.
export const wardHeading = (name: string) => name.replace(/\s*\((?!part\b)[^()]*\)/gi, '').trim();

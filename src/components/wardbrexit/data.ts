import { REJOIN_COLOUR, STAY_OUT_COLOUR } from './colours';

export const RESPONSES = {
  rejoin: { name: 'Rejoin the EU', color: REJOIN_COLOUR },
  out: { name: 'Stay out of the EU', color: STAY_OUT_COLOUR },
} as const;

export type Preference = keyof typeof RESPONSES;
export type Vote = [Preference, number, number, number];
export interface Ward {
  id: string;
  name: string;
  pcon: string;
  region: string;
  leader: Preference | 'tie';
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

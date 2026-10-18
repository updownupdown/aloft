// Songbird species and their songs. Notes are staff lines, 0 (bottom) to 4 (top).
import { hx } from './util.js';

export const SPECIES = [
  { name: 'Chickadee', notes: [4, 2], gap: .42, body: '#8a8a80', cap: '#2a2a2a', breast: '#efe6d0' },
  { name: 'Robin', notes: [2, 3, 2, 4, 3], gap: .28, body: '#6a5a4a', cap: '#3a3028', breast: '#d8703a' },
  { name: 'Warbler', notes: [0, 1, 2, 3, 4], gap: .18, body: '#a8a040', cap: '#6a7030', breast: '#f0d840' },
  { name: 'Wren', notes: [3, 3, 3, 1, 0, 2], gap: .16, body: '#8a6440', cap: '#6a4a30', breast: '#c8a070' },
  { name: 'Thrush', notes: [1, 3, 4, 2], gap: .34, body: '#7a6448', cap: '#5a4a38', breast: '#e8d8b8' },
  { name: 'Finch', notes: [2, 4, 2, 4, 3, 1], gap: .2, body: '#a04a40', cap: '#c03a3a', breast: '#e89080' },
].map((s, i) => ({ ...s, id: i, voice: i, cols: { body: hx(s.body), cap: hx(s.cap), breast: hx(s.breast) } }));

// The player's attempt at a song. Matching is on pitch order only, rhythm is free.
export function createStaff() {
  return { species: null, shown: [], tries: [], playing: null, lastTry: 0, learnedFlash: 0 };
}

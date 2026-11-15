// VISFX Ranked rules, identical to the VEGAS extension (Game.cs / Ranked.cs) and lib/ranked-ranks.ts.
// Pure functions: also loaded by the Node tests (test/run-tests.js).
"use strict";

const RANKS = [
  { name: "IRON", xp: 0, color: "#9aa0a8" }, { name: "BRONZE", xp: 2500, color: "#d0884f" }, { name: "SILVER", xp: 10000, color: "#d6dee8" },
  { name: "GOLD", xp: 35000, color: "#f5c542" }, { name: "PLATINUM", xp: 100000, color: "#4fd8c9" }, { name: "DIAMOND", xp: 250000, color: "#7cc8ff" },
  { name: "ASCENDANT", xp: 500000, color: "#b98cff" }, { name: "IMMORTAL", xp: 750000, color: "#c24bff" }, { name: "RADIANT", xp: 1000000, color: "#f45b58" },
];
const CHEST_COLORS = { ruby: "#ff3b5c", emerald: "#3ddc84", sapphire: "#4d8dff", prism: "#ff8ae2" };

const XP_PER_SECOND = 1/6;         // Tracker.XpPerSecond
const SESSION_GAP = 900;           // a session ends after 15 min without activity (Tracker.SessionGap)
const SESSION_COUNTS_AFTER = 60;   // a session counts after 1 min

function rankIndex(xp) { let i = 0; RANKS.forEach((r, k) => { if (xp >= r.xp) i = k; }); return i; }
function rankOf(xp) { return RANKS[rankIndex(xp)]; }
function nextRank(xp) { const i = rankIndex(xp); return i + 1 < RANKS.length ? RANKS[i + 1] : null; }

/** XP to go from level L to L+1 (Levels.Step). */
function levelStep(level) { return 1000 + 200 * (level - 1); }
/** Level of a total XP, with the XP already into it and the XP the level needs (Levels.Of). */
function levelOf(xp) {
  let lvl = 1, left = Math.max(0, Math.floor(xp));
  while (left >= levelStep(lvl)) { left -= levelStep(lvl); lvl++; }
  return { level: lvl, into: left, need: levelStep(lvl) };
}

/** Session multiplier: ×1.2 after 30 min, ×1.4 after 1 h. */
function multiplier(sessionSec) { return sessionSec < 1800 ? 1.0 : sessionSec < 3600 ? 1.2 : 1.4; }

/** Double XP every other weekend, local Saturday/Sunday of even weeks counted from Monday 2024-01-01 (Game.DoubleWeekend). */
function isDoubleWeekend(d) {
  d = d || new Date();
  const day = d.getDay();
  if (day !== 6 && day !== 0) return false;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((day + 6) % 7));
  const days = Math.round((Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()) - Date.UTC(2024, 0, 1)) / 86400000);
  return Math.floor(days / 7) % 2 === 0;
}
function boost(d) { return isDoubleWeekend(d) ? 2 : 1; }

/** Name colour a player picked (rank reached or chest colour). */
function nameColor(color, xp) {
  if (CHEST_COLORS[color]) return CHEST_COLORS[color];
  const i = RANKS.findIndex(r => r.name.toLowerCase() === color);
  return i > 0 && i <= rankIndex(xp) ? RANKS[i].color : "#f2eef0";
}

function fmt(n) { return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
function clock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  const p = n => (n < 10 ? "0" : "") + n;
  return (h > 0 ? h + ":" + p(m) : p(m)) + ":" + p(s);
}
function hours(sec) { const h = sec / 3600; return h >= 100 ? fmt(h) + " h" : h.toFixed(1).replace(".", ",") + " h"; }

module.exports = { RANKS, XP_PER_SECOND, SESSION_GAP, SESSION_COUNTS_AFTER, rankIndex, rankOf, nextRank, levelStep, levelOf, multiplier, isDoubleWeekend, boost, nameColor, fmt, clock, hours };

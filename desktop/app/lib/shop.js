// XP shop, avatar decorations and chest names: same ids, prices and unlock rules as the VEGAS extension
// (Shop.cs, Decos.cs, Chests.cs) and the server (lib/ranked-shop.ts, lib/ranked-decos.ts).
"use strict";

const I = (id, kind, fr, en, o) => Object.assign({ id, kind, fr, en, price: 0 }, o || {});
// Tier from the price: standard ≤ 500 (≤ 5 €) · premium 600–900 (animated, very styled) · prestige ≤ 1,000 (≤ 10 €). 100 tokens ≈ 1 €.
const P$ = (id, kind, fr, en, price, tier) => I(id, kind, fr, en, { price, tier: tier || (price <= 500 ? "standard" : price <= 900 ? "premium" : "prestige") });
const ITEMS = [
  P$("rgb_spectrum", "namefx", "Spectre RGB", "Espectro RGB", 350), P$("pastel_cloud", "namefx", "Nuage pastel", "Nube pastel", 300), P$("rainbow_wave", "namefx", "Arc-en-ciel", "Arcoíris", 400), P$("sunset_glow", "namefx", "Coucher de soleil", "Atardecer", 250), P$("arctic_ice", "namefx", "Glace arctique", "Hielo ártico", 250), P$("neon_dream", "namefx", "Rêve néon", "Sueño neón", 350), P$("rose_gold", "namefx", "Or rose", "Oro rosa", 300), P$("emerald_laser", "namefx", "Laser émeraude", "Láser esmeralda", 350),
  P$("glow", "namefx", "Lueur", "Glow", 100), P$("mint", "namefx", "Menthe", "Mint", 100), P$("peach", "namefx", "Pêche", "Peach", 100),
  P$("candy", "namefx", "Bonbon", "Candy", 150), P$("ice", "namefx", "Glace", "Ice", 150), P$("fire", "namefx", "Feu", "Fire", 200),
  P$("ocean", "namefx", "Océan", "Ocean", 200), P$("dusk", "namefx", "Crépuscule", "Dusk", 250), P$("sakura", "namefx", "Sakura", "Sakura", 250),
  P$("toxic", "namefx", "Toxique", "Toxic", 300), P$("chrome", "namefx", "Chrome", "Chrome", 400),
  P$("gold", "namefx", "Or massif", "Solid gold", 600), P$("vaporwave", "namefx", "Vaporwave", "Vaporwave", 700), P$("neon", "namefx", "Néon pulsé", "Neon pulse", 750),
  P$("glitchtext", "namefx", "Glitch", "Glitch", 800), P$("magma", "namefx", "Magma", "Magma", 800), P$("aurora", "namefx", "Aurore", "Aurora", 850),
  P$("rainbow", "namefx", "Arc-en-ciel", "Rainbow", 900), P$("holo", "namefx", "Holographique", "Holographic", 1000), P$("galaxy", "namefx", "Galaxie", "Galaxy", 1000),  // Formerly free (earned / chest), too nice: sold now; players who had them keep them (features-40.sql).
  P$("ember", "namefx", "Braise", "Ember", 700), P$("c_ruby", "namefx", "Rubis", "Ruby", 750), P$("c_emerald", "namefx", "Émeraude", "Emerald", 750),
  P$("c_sapphire", "namefx", "Saphir", "Sapphire", 750), P$("night", "namefx", "Nuit étoilée", "Starry night", 800), P$("diamond", "namefx", "Diamant", "Diamond", 900),
  P$("legend", "namefx", "Légende", "Legend", 1000), P$("c_prism", "namefx", "Prisme", "Prism", 1000),  I("creator", "namefx", "Signature nat.veg", "nat.veg signature", { creator: true }),
  // Banners: 1–3 € (100–300 tokens), tiers kept for the style
  P$("graphite", "banner", "Graphite", "Graphite", 100, "standard"),
  P$("mint", "banner", "Menthe", "Mint", 100, "standard"),
  P$("lilac", "banner", "Lilas", "Lilac", 100, "standard"),
  P$("peach", "banner", "Pêche", "Peach", 100, "standard"),
  P$("sky", "banner", "Ciel", "Sky", 100, "standard"),
  P$("sunset", "banner", "Coucher de soleil", "Sunset", 100, "standard"),
  P$("neon", "banner", "Néon", "Neon", 150, "standard"),
  P$("dune", "banner", "Dune", "Dune", 150, "standard"),
  P$("forest", "banner", "Forêt", "Forest", 150, "standard"),
  P$("deepsea", "banner", "Abysses", "Deep sea", 150, "standard"),
  P$("sakura", "banner", "Sakura", "Sakura", 150, "standard"),
  P$("lava", "banner", "Lave", "Lava", 200, "standard"),
  P$("waves", "banner", "Vagues", "Waves", 200, "standard"),
  P$("galaxy", "banner", "Galaxie", "Galaxy", 200, "standard"),
  P$("aurora", "banner", "Aurore boréale", "Northern lights", 200, "standard"),
  P$("thunder", "banner", "Tonnerre", "Thunder", 200, "standard"),
  P$("cyber", "banner", "Cyberpunk", "Cyberpunk", 250, "premium"),
  P$("matrix", "banner", "Matrice", "Matrix", 250, "premium"),
  P$("fireflies", "banner", "Lucioles", "Fireflies", 250, "premium"),
  P$("synthwave", "banner", "Synthwave", "Synthwave", 250, "premium"),
  P$("glitch", "banner", "Glitch", "Glitch", 250, "premium"),
  P$("hyperspace", "banner", "Hyperespace", "Hyperspace", 300, "premium"),
  P$("liquid", "banner", "Métal liquide", "Liquid metal", 300, "premium"),
  P$("vortex", "banner", "Vortex", "Vortex", 300, "premium"),
  P$("crystal", "banner", "Cristal", "Crystal", 300, "prestige"),
  P$("holo", "banner", "Holographique", "Holographic", 300, "prestige"),
  P$("eclipse", "banner", "Éclipse", "Eclipse", 300, "prestige"),
  P$("blackhole", "banner", "Trou noir", "Black hole", 300, "prestige"),
  // Profile photo decorations sold in the shop
  P$("dots", "deco", "Points", "Dots", 150), P$("hearts", "deco", "Cœurs", "Hearts", 250), P$("leaves", "deco", "Feuilles", "Leaves", 300), P$("ripple", "deco", "Onde", "Ripple", 400),
  P$("neonpulse", "deco", "Néon pulsé", "Neon pulse", 700), P$("vinyl", "deco", "Vinyle", "Vinyl", 700), P$("fireflies", "deco", "Lucioles", "Fireflies", 750),
  P$("lightning", "deco", "Éclairs", "Lightning", 800), P$("film", "deco", "Pellicule", "Film reel", 800), P$("rings", "deco", "Anneaux", "Rings", 850),
  P$("wings", "deco", "Ailes", "Wings", 1000), P$("phoenix", "deco", "Phénix", "Phoenix", 1000), P$("vortex", "deco", "Vortex", "Vortex", 1000),  I("goldrush", "banner", "Ruée vers l'or", "Gold rush", { condFr: "Atteins Gold (35 000 XP)", condEn: "Reach Gold (35,000 XP)", unlock: s => s.xp >= 35000 }),
  I("veteran", "banner", "Vétéran", "Veteran", { condFr: "300 sessions de montage", condEn: "300 editing sessions", unlock: s => s.sessions >= 300 }),
  I("c_nebula", "banner", "Nébuleuse", "Nebula", { chest: "epic" }), I("c_inferno", "banner", "Inferno", "Inferno", { chest: "epic" }),
  I("c_royal", "banner", "Trésor royal", "Royal treasure", { chest: "legendary" }), I("visfx", "banner", "VISFX", "VISFX", { creator: true }),
];
// Rank rewards use the existing thresholds and are available to established profiles too.
for(const rank of require('./rules').RANKS){
 ITEMS.push(I('rank_'+rank.name.toLowerCase(),'banner','Timeline '+rank.name,'Timeline '+rank.name,{condFr:'Alcanza '+rank.name,condEn:'Alcanza '+rank.name,unlock:s=>s.xp>=rank.xp}));
}
/** Section of an item in the shop (collapsible categories). */
function section(it) { return it.creator ? "creator" : it.chest ? "chest" : it.unlock ? "unlock" : it.tier || "standard"; }
const SECTIONS = ["standard", "premium", "prestige", "unlock", "chest", "creator"];
const DECOS = [
  ["c_royal", "Aura royale", "Royal aura", s => s.chest.includes("deco:c_royal") || s.creator, "Coffre légendaire", "Legendary chest"],
  ["bubbles", "Bulles", "Bubbles", s => s.seconds >= 50 * 3600, "50 h de montage", "50 h of editing"],
  ["petals", "Pétales", "Petals", s => s.best >= 14, "Série record de 14 jours", "14-day streak record"],
  ["comet", "Comète", "Comet", s => s.has("render_10"), "Succès Machine à contenu", "Content Machine achievement"],
  ["snow", "Neige", "Snow", s => s.has("quest_machine"), "Succès Machine à quêtes", "Quest Machine achievement"],
  ["pixel", "Pixels", "Pixels", s => s.has("butcher"), "Succès Boucher", "Butcher achievement"],
  ["neonring", "Néon", "Neon", s => s.has("gladiator"), "Succès Gladiateur", "Gladiator achievement"],
  ["sparkle", "Étincelles", "Sparkles", s => s.xp >= 100000, "100 000 XP", "100,000 XP"],
  ["rain", "Pluie", "Rain", s => s.best >= 30, "Série record de 30 jours", "30-day streak record"],
  ["orbit", "Orbite", "Orbit", s => s.unlocked >= 50, "50 succès", "50 achievements"],
  ["flame", "Flammes", "Flames", s => s.xp >= 250000, "Rang Diamond", "Diamond rank"],
  ["storm", "Orage", "Storm", s => s.seconds >= 500 * 3600, "500 h de montage", "500 h of editing"],
  ["aurora", "Aurore", "Aurora", s => s.xp >= 750000, "Rang Immortal", "Immortal rank"],
  ["halo", "Halo", "Halo", s => s.xp >= 1000000, "Rang Radiant", "Radiant rank"],
  ["champion", "Champion de saison", "Season champion", s => s.special.includes("champion") || s.creator, "Top 3 de la saison passée", "Top 3 of last season"],
  ["founder", "Lauriers du fondateur", "Founder's laurels", s => s.special.includes("founder") || s.creator, "10 premiers joueurs", "First 10 players"],
  ["creator", "Couronne du créateur", "Creator's crown", s => s.creator, "nat.veg", "nat.veg"],
  ["visfx", "Glitch VISFX", "VISFX glitch", s => s.creator, "nat.veg", "nat.veg"],
].map(([id, fr, en, ok, condFr, condEn]) => ({ id, fr, en, ok, condFr, condEn }));
// Decorations sold in the shop: in the Customize list too, unlocked once bought (or won in a chest).
for (const it of ITEMS.filter(x => x.kind === "deco")) DECOS.push({ id: it.id, fr: it.fr, en: it.en, ok: s => s.creator || s.owned.includes("deco:" + it.id) || s.chest.includes("deco:" + it.id), condFr: it.price + " jetons (boutique)", condEn: it.price + " tokens (shop)", price: it.price });
const CHEST_COLORS = { ruby: ["Rubis", "Ruby", "#FF3B5C"], emerald: ["Émeraude", "Emerald", "#3DDC84"], sapphire: ["Saphir", "Sapphire", "#4D8DFF"], prism: ["Prisme", "Prism", "#FF8AE2"] };
const RARITY = { legendary: ["COFFRE LÉGENDAIRE", "LEGENDARY CHEST", "#FFC43C", "Légendaire", "Legendary"], epic: ["COFFRE ÉPIQUE", "EPIC CHEST", "#B45FFF", "Épique", "Epic"],
  iron: ["COFFRE EN FER", "IRON CHEST", "#A0B4C8", "Fer", "Iron"], wood: ["COFFRE EN BOIS", "WOODEN CHEST", "#B47D4B", "Bois", "Wood"] };

/** Account state the unlock rules read. */
function state(core) {
  const P = core.game.P, srv = core.server || {}, ul = new Set([...Object.keys(P.Unlocked), ...(srv.unlocked || [])]);
  return { xp: core.totalXp, seconds: core.totalSec, best: Math.max(P.BestStreak, srv.best || 0), sessions: Math.max(P.Sessions, srv.sessions || 0), unlocked: ul.size,
    has: id => ul.has(id), chest: P.ChestItems || [], owned: (core.tokens && core.tokens.owned) || [], special: srv.special || [], creator: String(core.account && core.account.name || "").toLowerCase() === "nat.veg" };
}
function owned(core, it) {
  const s = state(core), P = core.game.P;
  if (it.creator) return s.creator;
  if (it.chest) return s.creator || (P.ChestItems || []).includes(it.kind + ":" + it.id);
  if (it.unlock) return s.creator || it.unlock(s);
  // Sold for tokens: owned on the server (bought, won in a chest, grandfathered) — /api/ranked/tokens status.
  return !!(core.tokens && (core.tokens.owned || []).includes(it.kind + ":" + it.id)) || (P.ChestItems || []).includes(it.kind + ":" + it.id);
}
/** Token balance kept by the server (free: 1 per 250 XP; bought with real money; spent in the shop). */
function tokens(core) { return core.tokens ? core.tokens.balance || 0 : 0; }
/** Euro price of a pack (cents → "4,99 €"). */
function euros(cents, fr) { const v = (cents / 100).toFixed(2); return fr ? v.replace(".", ",") + " €" : "€" + v; }
function itemName(item, T) {
  const k = item.indexOf(":"), kind = item.slice(0, k), id = item.slice(k + 1);
  if (kind === "deco") { const d = DECOS.find(x => x.id === id); return d ? T(d.fr, d.en) : id; }
  if (kind === "color") { const c = CHEST_COLORS[id]; return c ? T(c[0], c[1]) : id; }
  const i = ITEMS.find(x => x.kind === kind && x.id === id); return i ? T(i.fr, i.en) : id;
}

module.exports = { ITEMS, SECTIONS, section, DECOS, CHEST_COLORS, RARITY, state, owned, tokens, euros, itemName };

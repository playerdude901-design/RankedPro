// Game rules ported from the VEGAS extension (Game.cs, Extras.cs): profile, XP, days/streak, lifetime + weekly stats,
// 92 achievements, 5 weekly targets (same draw as VEGAS), daily quest, action bonus cap.
// Field names follow Game.cs Profile so both editors speak the same language. Pure logic (clock injected).
"use strict";
const R = require("./rules.js");
const { NetRandom } = require("./netrandom.js");

function pad2(n) { return (n < 10 ? "0" : "") + n; }
function dayKey(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
const EPOCH_UTC = Date.UTC(2024, 0, 1);

function newProfile() {
  return {
    Xp: 0, ActiveSec: 0, CapCutSec: 0, LongestSession: 0, OwlSec: 0, EarlySec: 0, LongestRender: 0,
    Sessions: 0, Streak: 0, BestStreak: 0, WeeksCleared: 0, LastStreakDay: "", Day: "", DaySec: 0,
    Stats: {}, ActiveDays: [], Unlocked: {}, Week: "", WeekStats: {}, WeekCleared: [], BonusHour: "", BonusXp: 0,
    DayLog: {}, DayXp: {}, Projects: {}, DayStats: {}, DayStatsDay: "", DailyDone: "", StreakWarned: "",
    LastNightDay: "", AchSeen: [], Rivals: [], FollowersSeen: [], Socials: {}, Owned: [], Avatar: "",
    Badges: null, Title: "", EarnedTitle: "", Bio: "", innerBorder: "none", outerBorder: "none", NameColor: "", Hidden: [], RankSeen: -1, DayGoal: 0, HoursGoal: 0, GoalHitWeek: "",
    ChestItems: [], TokensSpent: 0, TokensBonus: 0, GiftsClaimed: [], Deco: "", NameFx: "", Banner: "", Dm: "all", InviteSeen: false,
    Lang: -1, Theme: 1, Fps: 0, Sound: 2, NoTranslate: false, NoErrorReports: false, Layout: "", Focus: false, DayGoalHit: "", Mini: false, MiniBig: false, MoneyRate: 0, MoneyCur: "", ProjectRates: {}, SessionMoney: 0, SessionMoneyCur: "", Notes: {},
  };
}

// --------------------------------------------------------------------------- achievements (Game.Achievements, same order)
const H = p => p.ActiveSec / 3600;
function weekendDone(p) {
  for (const d of p.ActiveDays) {
    const t = new Date(d + "T12:00:00");
    if (t.getDay() === 6 && p.ActiveDays.includes(dayKey(addDays(t, 1)))) return true;
  }
  return false;
}
function maxProject(p) { let m = 0; for (const k in p.Projects) m = Math.max(m, p.Projects[k]); return m; }
function fullSeason(p, now) {
  // Previous season: quarters until the end of 2026, then half-years (like the server's seasons).
  const seasonStart = d => d.getFullYear() >= 2027 ? new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1) : new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  const end = seasonStart(now), start = seasonStart(addDays(end, -1));
  for (let d = start; d < end; d = addDays(d, 1)) if ((p.DayLog[dayKey(d)] || 0) < 60) return false;
  return true;
}
const SOCIAL_KEYS = 7;      // Socials.Keys.Length (instagram, x, tiktok, youtube, twitch, discord, portfolio)

function defs(g) {
  const S = k => g.stat(k), A = (id, glyph, en, fr, dEn, dFr, v, goal, reward, secret) => ({ id, glyph, en, fr, dEn, dFr, v, goal, reward, secret: !!secret });
  return [
    A("first_steps", 0xF133, "First Steps", "Premiers pas", "Edit 30 minutes in a single session", "Monte 30 minutes dans une même session", p => p.LongestSession / 60, 30, 50),
    A("warm_up", 0xED5A, "Warm Up", "Échauffement", "Edit for 5 hours in total", "Monte 5 heures au total", H, 5, 100),
    A("serious", 0xE823, "Getting Serious", "Ça devient sérieux", "Edit for 25 hours in total", "Monte 25 heures au total", H, 25, 250),
    A("dedicated", 0xE916, "Dedicated", "Dévoué", "Edit for 100 hours in total", "Monte 100 heures au total", H, 100, 500),
    A("centurion", 0xE81C, "Centurion", "Centurion", "Edit for 250 hours in total", "Monte 250 heures au total", H, 250, 1000),
    A("quarter", 0xECC5, "Half Thousand", "Demi-millier", "Work 500 hours total", "Travaille 500 heures au total", H, 500, 2000),
    A("thousand", 0xE1CF, "Thousand Hours", "Mille heures", "Work 1,000 hours total", "Travaille 1 000 heures au total", H, 1000, 5000),
    A("in_the_zone", 0xE945, "In The Zone", "Dans la zone", "Stay focused 2 hours in a single session", "Reste concentré 2 h dans une même session", p => p.LongestSession / 3600, 2, 200),
    A("marathon", 0xEC4A, "Marathon", "Marathon", "Edit 5 hours in a single session", "Monte 5 h dans une même session", p => p.LongestSession / 3600, 5, 500),
    A("night_owl", 0xE708, "Night Owl", "Oiseau de nuit", "Edit 5 hours in total between midnight and 5 AM", "Monte 5 h au total entre minuit et 5 h", p => p.OwlSec / 3600, 5, 150),
    A("early_bird", 0xE706, "Early Bird", "Lève-tôt", "Edit 5 hours in total between 5 and 8 AM", "Monte 5 h au total entre 5 h et 8 h", p => p.EarlySec / 3600, 5, 150),
    A("weekend", 0xE787, "Weekend Warrior", "Guerrier du week-end", "Edit on a Saturday and the Sunday after", "Monte un samedi et le dimanche suivant", p => weekendDone(p) ? 1 : 0, 1, 200),
    A("streak_3", 0xECAD, "On Fire", "En feu", "Reach a 3-day streak", "Atteins une série de 3 jours", p => p.BestStreak, 3, 150),
    A("streak_7", 0xECAD, "Unstoppable", "Inarrêtable", "Reach a 7-day streak", "Atteins une série de 7 jours", p => p.BestStreak, 7, 400),
    A("streak_30", 0xECAD, "Habit Formed", "Habitude prise", "Reach a 30-day streak", "Atteins une série de 30 jours", p => p.BestStreak, 30, 2000),
    A("first_render", 0xE768, "Ship It", "Envoie !", "Finish 5 renders", "Termine 5 rendus", () => S("renders"), 5, 100),
    A("render_10", 0xE714, "Content Machine", "Machine à contenu", "Finish 50 renders", "Termine 50 rendus", () => S("renders"), 50, 300),
    A("render_100", 0xE722, "Studio", "Studio", "Finish 250 renders", "Termine 250 rendus", () => S("renders"), 250, 1500),
    A("render_2h", 0xE9F5, "Patience", "Patience", "Finish a render that lasted 2 hours straight", "Termine un rendu de 2 heures d'affilée", p => p.LongestRender / 3600, 2, 200),
    A("render_3h", 0xE9F5, "Heavy Lifting", "Gros calibre", "Finish a render that lasted 3 hours straight", "Termine un rendu de 3 heures d'affilée", p => p.LongestRender / 3600, 3, 300),
    A("render_4h", 0xE9F5, "Render Farm", "Ferme de rendu", "Finish a render that lasted 4 hours straight", "Termine un rendu de 4 heures d'affilée", p => p.LongestRender / 3600, 4, 400),
    A("render_5h", 0xE9F5, "Melting GPU", "GPU en fusion", "Finish a render that lasted 5 hours straight", "Termine un rendu de 5 heures d'affilée", p => p.LongestRender / 3600, 5, 500),
    A("crash_100", 0xE7BA, "Crash Test Dummy", "Cascadeur", "Survive 100 VEGAS crashes", "Survis à 100 crashs de VEGAS", () => S("crashes"), 100, 666),
    A("cutter", 0xE8C6, "Cutter", "Coupeur", "Make 1,000 edits (new clips or cuts)", "Fais 1 000 montages (clips ou coupes)", () => S("edits"), 1000, 150),
    A("butcher", 0xE8C6, "Butcher", "Boucher", "Make 10,000 edits", "Fais 10 000 montages", () => S("edits"), 10000, 600),
    A("editor_10k", 0xE9D2, "Ten Thousand Cuts", "Dix mille coupes", "Make 50,000 edits", "Fais 50 000 montages", () => S("edits"), 50000, 3000),
    A("fx_fiend", 0xE9E9, "FX Fiend", "Accro aux FX", "Add 300 effects", "Ajoute 300 effets", () => S("fx"), 300, 250),
    A("fx_wizard", 0xE790, "FX Wizard", "Sorcier des FX", "Add 3,000 effects", "Ajoute 3 000 effets", () => S("fx"), 3000, 1000),
    A("keyframer", 0xE9D9, "Keyframer", "Keyframer", "Add 1,000 Pan/Crop keyframes", "Ajoute 1 000 images clés Pan/Crop", () => S("keys"), 1000, 300),
    A("marker", 0xE7C1, "Cartographer", "Cartographe", "Place 300 markers or regions", "Place 300 marqueurs ou régions", () => S("markers"), 300, 150),
    A("saver", 0xE74E, "Ctrl+S Reflex", "Réflexe Ctrl+S", "Save your project 1,000 times", "Enregistre ton projet 1 000 fois", () => S("saves"), 1000, 200),
    A("sessions_10", 0xE895, "Regular", "Habitué", "Complete 30 sessions", "Fais 30 sessions", p => p.Sessions, 30, 200),
    A("sessions_100", 0xE7FC, "Veteran", "Vétéran", "Complete 300 sessions", "Fais 300 sessions", p => p.Sessions, 300, 1000),
    A("level_10", 0xE734, "Level 10", "Niveau 10", "Reach level 10", "Atteins le niveau 10", () => R.levelOf(g.xp()).level, 10, 300),
    A("level_25", 0xE735, "Level 25", "Niveau 25", "Reach level 25", "Atteins le niveau 25", () => R.levelOf(g.xp()).level, 25, 800),
    A("level_50", 0xEB52, "Level 50", "Niveau 50", "Reach level 50", "Atteins le niveau 50", () => R.levelOf(g.xp()).level, 50, 2000),
    A("gold", 0xE7BE, "Gold Rush", "Ruée vers l'or", "Reach Gold rank", "Atteins le rang Gold", () => g.xp(), 35000, 500),
    A("diamond", 0xEA80, "Shine Bright", "Brille", "Reach Diamond rank", "Atteins le rang Diamond", () => g.xp(), 250000, 2000),
    A("weekly", 0xE930, "Weekly Champion", "Champion de la semaine", "Clear all 5 weekly targets", "Valide les 5 objectifs d'une semaine", p => p.WeeksCleared, 1, 500),
    A("arsenal", 0xE8F1, "Arsenal Operator", "Opérateur Arsenal", "Use VISFX Arsenal 300 times", "Utilise VISFX Arsenal 300 fois", () => S("tool_arsenal"), 300, 300),
    A("counter", 0xE8EF, "Number Cruncher", "Compteur fou", "Create 50 counters with VISFX Counter", "Crée 50 compteurs avec VISFX Counter", () => S("tool_counter"), 50, 300),
    A("speedrun", 0xE916, "Speedrunner", "Speedrunner", "Finish a render within 10 minutes of opening the project", "Termine un rendu moins de 10 min après l'ouverture du projet", () => S("speedrun"), 1, 200),
    A("undo_1000", 0xE7A7, "Ctrl+Z Addict", "Accro au Ctrl+Z", "Undo 5,000 times", "Annule 5 000 fois", () => S("undo"), 5000, 300),
    A("insomnia", 0xE708, "Insomniac", "Insomniaque", "Still editing at 2 AM in a session started the day before", "Encore en train de monter à 2 h dans une session commencée la veille", () => S("insomnia"), 1, 250),
    A("dawn", 0xE706, "Dawn Patrol", "Patrouille de l'aube", "Edit between 3 and 5 AM on 10 different days", "Monte entre 3 h et 5 h, 10 jours différents", () => S("night35"), 10, 500),
    A("comeback", 0xE72C, "The Comeback", "Le Retour", "Come back to edit after 30 days away", "Reviens monter après 30 jours d'absence", () => S("comeback"), 1, 200),
    A("faithful", 0xE787, "Faithful", "Fidèle", "Edit on 365 different days", "Monte 365 jours différents", () => S("days"), 365, 5000),
    A("fx_collector", 0xE790, "FX Collector", "Collectionneur de FX", "Use 100 different effects", "Utilise 100 effets différents", () => S("fxkinds"), 100, 500),
    A("multicam", 0xE8B3, "Multicam", "Multicam", "Have 20 video tracks in one project", "Aie 20 pistes vidéo dans un même projet", () => S("vtracks"), 20, 300),
    A("long_timeline", 0xE714, "Endless Timeline", "Timeline infinie", "Work on a project longer than 1 hour", "Travaille sur un projet de plus d'une heure", () => S("projmin"), 60, 300),
    A("musician", 0xE8D6, "Musician", "Musicien", "Make 1,000 edits on audio clips", "Fais 1 000 montages sur des clips audio", () => S("audioedits"), 1000, 250),
    A("perfectionist", 0xE74E, "Perfectionist", "Perfectionniste", "Save the same project 300 times", "Enregistre le même projet 300 fois", () => S("maxpsaves"), 300, 300),
    A("rival_beat", 0xE7EE, "Rival Down", "Rival vaincu", "Pass one of your rivals", "Dépasse un de tes rivaux", () => S("rivalbeat"), 1, 300),
    A("podium", 0xE734, "Podium", "Podium", "Finish a season in the top 3", "Termine une saison dans le top 3", () => S("podium"), 1, 2000),
    A("country_top", 0xE909, "National Champion", "Champion du pays", "Be #1 in your country", "Sois n°1 de ton pays", () => S("countrytop"), 1, 1000),
    A("crazy_weekend", 0xE945, "Crazy Weekend", "Week-end de folie", "Earn 2,000 XP during a double XP weekend", "Gagne 2 000 XP pendant un week-end double XP", () => S("dblweekend"), 2000, 400),
    A("social", 0xE8FA, "Social", "Social", "Link 3 social networks to your profile", "Relie 3 réseaux sociaux à ton profil", p => Object.keys(p.Socials).length, 3, 100),
    A("influencer", 0xEC24, "Influencer", "Influenceur", "Share your card or recap 25 times", "Partage ta carte ou ton récap 25 fois", () => S("shares"), 25, 200),
    A("visfx_trio", 0xEA86, "VISFX Loyal", "Fidèle VISFX", "Use Arsenal, Counter and Ranked on the same day", "Utilise Arsenal, Counter et Ranked le même jour", () => S("trio"), 1, 300),
    A("ghost_render", 0xE711, "Ghost Render", "Rendu fantôme", "Cancel 50 renders", "Annule 50 rendus", () => S("cancels"), 50, 150),
    A("first_photo", 0xE722, "First Impression", "Première impression", "Add a profile photo", "Ajoute une photo de profil", p => p.Avatar ? 1 : 0, 1, 100),
    A("collector", 0xEA86, "Completionist", "Complétiste", "Unlock 40 achievements", "Débloque 40 succès", p => Object.keys(p.Unlocked).length, 40, 1500),
    A("icebreaker", 0xE8BD, "Icebreaker", "Brise-glace", "Send your first private message", "Envoie ton premier message privé", () => S("messages"), 1, 50),
    A("chatterbox", 0xE8F2, "Chatterbox", "Bavard", "Send 100 private messages", "Envoie 100 messages privés", () => S("messages"), 100, 300),
    A("networker", 0xE716, "Networker", "Réseauteur", "Follow 5 rivals at the same time", "Suis 5 rivaux en même temps", p => p.Rivals.length, 5, 150),
    A("popular", 0xE77B, "Popular", "Populaire", "Get added as a rival by 10 players", "Sois ajouté en rival par 10 joueurs", p => p.FollowersSeen.length, 10, 400),
    A("gauntlet", 0xE7C1, "Gauntlet Thrown", "Gant jeté", "Send your first challenge", "Lance ton premier défi", () => S("ch_created"), 1, 50),
    A("duelist", 0xE945, "Duelist", "Duelliste", "Win a challenge", "Gagne un défi", () => S("challenges_won"), 1, 200),
    A("gladiator", 0xE735, "Gladiator", "Gladiateur", "Win 10 challenges", "Gagne 10 défis", () => S("challenges_won"), 10, 1000),
    A("undefeated", 0xE81D, "Undefeated", "Invaincu", "Win 3 challenges in a row", "Gagne 3 défis d'affilée", () => S("ch_best"), 3, 600),
    A("high_roller", 0xEC4A, "High Roller", "Gros joueur", "Win a challenge with a stake of 1,000 XP or more", "Gagne un défi avec une mise de 1 000 XP ou plus", () => S("ch_bigwin"), 1, 500),
    A("fair_play", 0xE8E1, "Fair Play", "Fair-play", "Finish a challenge in a draw", "Termine un défi sur une égalité", () => S("ch_draw"), 1, 150),
    A("quester", 0xE930, "Quester", "Quêteur", "Clear 10 daily quests", "Valide 10 quêtes du jour", () => S("dailies"), 10, 300),
    A("quest_machine", 0xE787, "Quest Machine", "Machine à quêtes", "Clear the daily quest 7 days in a row", "Valide la quête du jour 7 jours d'affilée", () => S("daily_best"), 7, 600),
    A("goal_kept", 0xE916, "Goal Kept", "Objectif tenu", "Reach your hours goal 4 weeks in a row", "Atteins ton objectif d'heures 4 semaines d'affilée", () => S("goal_best"), 4, 800),
    A("long_haul", 0xE8B7, "Long Haul", "Projet fleuve", "Spend 20 hours on a single project", "Passe 20 heures sur un même projet", p => maxProject(p) / 3600, 20, 500),
    A("all_rounder", 0xE8F1, "All-Rounder", "Touche-à-tout", "Edit 25 different projects", "Monte sur 25 projets différents", p => Object.keys(p.Projects).length, 25, 400),
    A("finisher", 0xE768, "Finisher", "Finisher", "Render a project you spent 5 hours or more on", "Rends un projet sur lequel tu as passé 5 h ou plus", () => S("finisher"), 1, 300),
    A("first_buy", 0xE7BF, "First Purchase", "Premier achat", "Buy something in the XP shop", "Achète un objet dans la boutique d'XP", () => S("purchases"), 1, 100),
    A("fashionista", 0xE771, "Fashionista", "Fashionista", "Own 5 cosmetics from the shop", "Possède 5 cosmétiques de la boutique", p => p.Owned.length, 5, 400),
    A("showcase", 0xE774, "Showcase", "Vitrine", "Fill in all your socials and your portfolio", "Remplis tous tes réseaux et ton portfolio", p => Object.keys(p.Socials).length, SOCIAL_KEYS, 200),
    A("recap_shared", 0xE72D, "Monthly Recap", "Récap partagé", "Share your monthly recap", "Partage ton récap du mois", () => S("monthshares"), 1, 100),
    A("recruiter", 0xE8FA, "Recruiter", "Recruteur", "Invite a friend who edits their first hour", "Invite un ami qui fait sa première heure de montage", () => S("invites"), 1, 300),
    A("ambassador", 0xE716, "Ambassador", "Ambassadeur", "Invite 5 friends who edit their first hour", "Invite 5 amis qui font leur première heure de montage", () => S("invites"), 5, 1000),
    A("first_post", 0xE8BD, "First Post", "Premier post", "Publish your first post", "Publie ton premier post", () => S("posts"), 1, 100),
    A("content_creator", 0xE70F, "Content Creator", "Créateur de contenu", "Publish 25 posts", "Publie 25 posts", () => S("posts"), 25, 600),
    A("first_clip", 0xE714, "Premiere", "Avant-première", "Share a clip of your timeline", "Partage un extrait de ta timeline", () => S("clips"), 1, 150),
    A("showreel", 0xE8B2, "Showreel", "Showreel", "Share 10 clips of your timeline", "Partage 10 extraits de ta timeline", () => S("clips"), 10, 800),
    A("gallery", 0xE8B9, "Gallery", "Galerie", "Show 5 posts on your public profile", "Affiche 5 posts sur ton profil public", () => S("profile_posts"), 5, 300),
    A("new_year", 0xE1CF, "New Year", "Nouvel an", "Edit at midnight on January 1st", "Monte à minuit le 1er janvier", () => S("newyear"), 1, 500, true),
    A("season_faithful", 0xE81C, "Faithful to the Post", "Fidèle au poste", "Edit every single day of a whole season", "Monte chaque jour d'une saison complète", p => fullSeason(p, g.date()) ? 1 : 0, 1, 5000, true),
    A("beat_natveg", 0xE7FC, "Gana al Creador", "Gana al Creador", "Gana un desafío contra el creador de Ranked Pro.", "Gana un desafío contra el creador de Ranked Pro.", () => S("beat_natveg"), 1, 1500, true),
  ];
}

// Categories and tiers (RankedPanel.AchCat / AchTier)
const CATS = ["time", "streak", "render", "edit", "social", "progress", "secret"];
const CAT_OF = {};
for (const id of ["first_steps", "warm_up", "serious", "dedicated", "centurion", "quarter", "thousand", "in_the_zone", "marathon", "night_owl", "early_bird", "insomnia", "dawn", "long_haul", "long_timeline"]) CAT_OF[id] = "time";
for (const id of ["weekend", "streak_3", "streak_7", "streak_30", "sessions_10", "sessions_100", "comeback", "faithful", "quester", "quest_machine", "goal_kept", "weekly"]) CAT_OF[id] = "streak";
for (const id of ["first_render", "render_10", "render_100", "render_2h", "render_3h", "render_4h", "render_5h", "speedrun", "ghost_render", "finisher", "crash_100"]) CAT_OF[id] = "render";
for (const id of ["cutter", "butcher", "editor_10k", "fx_fiend", "fx_wizard", "keyframer", "marker", "saver", "undo_1000", "fx_collector", "multicam", "musician", "perfectionist", "all_rounder", "arsenal", "counter", "visfx_trio"]) CAT_OF[id] = "edit";
for (const id of ["social", "influencer", "first_photo", "icebreaker", "chatterbox", "networker", "popular", "gauntlet", "duelist", "gladiator", "undefeated", "high_roller", "fair_play", "rival_beat", "showcase", "recap_shared", "recruiter", "ambassador", "first_post", "content_creator", "first_clip", "showreel", "gallery"]) CAT_OF[id] = "social";
const achCat = a => a.secret ? "secret" : CAT_OF[a.id] || "progress";
const achTier = a => a.reward <= 150 ? 0 : a.reward <= 400 ? 1 : a.reward <= 1000 ? 2 : 3;

// Weekly pool (Game.Pool) and daily pool (Extras.Pool). The texts say VEGAS in VEGAS; here "Premiere".
const POOL = [
  ["warmup", "focus", 60, 1, 100, "Warm-Up", "Échauffement", "Focus 1 hour in Premiere", "Concentre-toi 1 heure dans Premiere"],
  ["deep_work", "focus", 300, 3, 300, "Deep Work", "Travail profond", "Focus 5 hours in Premiere", "Concentre-toi 5 heures dans Premiere"],
  ["grind", "focus", 600, 4, 450, "The Grind", "Le grind", "Focus 10 hours in Premiere", "Concentre-toi 10 heures dans Premiere"],
  ["clips", "edits", 150, 2, 200, "Clip Machine", "Machine à clips", "Make 150 edits (new clips or cuts)", "Fais 150 montages (clips ou coupes)"],
  ["chop", "edits", 500, 4, 400, "Chop Shop", "Découpe intensive", "Make 500 edits", "Fais 500 montages"],
  ["ship", "renders", 1, 1, 100, "Ship It", "Envoie !", "Finish a render", "Termine un rendu"],
  ["ship3", "renders", 3, 2, 250, "Triple Drop", "Triple sortie", "Finish 3 renders", "Termine 3 rendus"],
  ["fx", "fx", 15, 2, 150, "FX Lab", "Labo FX", "Add 15 effects to clips", "Ajoute 15 effets aux clips"],
  ["keys", "keys", 30, 3, 200, "Keyframe Artist", "Artiste des images clés", "Add 30 Pan/Crop keyframes", "Ajoute 30 images clés Pan/Crop"],
  ["days", "days", 5, 3, 300, "Daily Grind", "Tous les jours", "Edit on 5 different days", "Monte 5 jours différents"],
  ["night", "night", 60, 2, 150, "Night Shift", "Équipe de nuit", "Edit 1 hour after 10 PM", "Monte 1 heure après 22 h"],
  ["marathon", "session", 120, 3, 250, "Marathon", "Marathon", "One session of 2 hours", "Une session de 2 heures"],
  ["saves", "saves", 20, 1, 100, "Safe Player", "Prudent", "Save your project 20 times", "Enregistre ton projet 20 fois"],
  ["markers", "markers", 20, 2, 120, "Map Maker", "Cartographe", "Place 20 markers or regions", "Place 20 marqueurs ou régions"],
  ["trims", "trims", 300, 2, 150, "Fine Tuning", "Peaufinage", "Move or trim clips 300 times", "Déplace ou rogne des clips 300 fois"],
  ["tracks", "tracks", 10, 1, 100, "Layer Cake", "Mille-feuille", "Create 10 tracks", "Crée 10 pistes"],
].map(([id, stat, goal, diff, reward, en, fr, dEn, dFr]) => ({ id, stat, goal, diff, reward, en, fr, dEn, dFr, max: stat === "session" }));
const DAILY = [
  ["d_focus", "focus", 45, 80, "Edit for 45 minutes", "Monte 45 minutes"], ["d_focus90", "focus", 90, 140, "Edit for 1 h 30", "Monte 1 h 30"],
  ["d_edits", "edits", 40, 80, "Make 40 edits", "Fais 40 montages"], ["d_trims", "trims", 80, 80, "Move or trim clips 80 times", "Déplace ou rogne des clips 80 fois"],
  ["d_fx", "fx", 6, 90, "Add 6 effects", "Ajoute 6 effets"], ["d_keys", "keys", 12, 90, "Add 12 Pan/Crop keyframes", "Ajoute 12 images clés Pan/Crop"],
  ["d_saves", "saves", 6, 60, "Save your project 6 times", "Enregistre ton projet 6 fois"], ["d_markers", "markers", 6, 70, "Place 6 markers or regions", "Place 6 marqueurs ou régions"],
  ["d_render", "renders", 1, 100, "Finish a render", "Termine un rendu"],
].map(([id, stat, goal, reward, en, fr]) => ({ id, stat, goal, reward, en, fr }));

const BONUS_CAP_PER_HOUR = 120;

class Game {
  constructor(opts) {
    opts = opts || {};
    this.now = opts.now || (() => Date.now());
    this.P = Object.assign(newProfile(), opts.profile || {});
    this.serverXp = () => (opts.serverXp ? opts.serverXp() : 0);
    this.onXp = opts.onXp || (() => {});         // XP earned here → sync batch
    this.onToast = opts.onToast || (() => {});
    this.limits = {};
    this.xpFrac = 0;
    this.doubleGain = 0;
    this.ACH = defs(this);
    this.rollWeek();
  }
  date() { return new Date(this.now()); }
  today() { return dayKey(this.date()); }
  /** Total XP shown everywhere: what the server counts + what was earned here and not yet counted. */
  xp() { return this.serverXp(); }
  stat(k) { return this.P.Stats[k] || 0; }
  wstat(k) { return this.P.WeekStats[k] || 0; }
  unix() { return Math.floor(this.now() / 1000); }

  // ------------------------------------------------------------------ XP
  addXp(xp) {
    this.xpFrac += xp;
    if (this.xpFrac < 1) return;
    const n = Math.floor(this.xpFrac); this.xpFrac -= n;
    const d = this.today(); this.P.DayXp[d] = (this.P.DayXp[d] || 0) + n;
    if (R.isDoubleWeekend(this.date())) {
      const t = this.date(), sat = t.getDay() === 0 ? addDays(t, -1) : t, wk = "dxp:" + dayKey(sat);
      this.P.Stats[wk] = (this.P.Stats[wk] || 0) + n; this.max("dblweekend", this.P.Stats[wk]);
    }
    this.onXp(n);
  }
  doubled(reward) { if (!R.isDoubleWeekend(this.date())) return reward; this.doubleGain += reward; return reward * 2; }
  /** Action bonus (cut, FX, render…), capped per hour like VEGAS (Game.Bonus). */
  bonus(xp) {
    const d = this.date(), h = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + pad2(d.getHours());
    if (this.P.BonusHour !== h) { this.P.BonusHour = h; this.P.BonusXp = 0; }
    const boost = 1;
    const give = Math.max(0, Math.min(xp, BONUS_CAP_PER_HOUR * boost - this.P.BonusXp));
    this.P.BonusXp += give;
    if (boost > 1) this.doubleGain += give / 2;
    this.addXp(give);
    return give;
  }
  /** Per-minute limit of a counter (Tracker.Limit): returns how many of n are allowed. */
  limit(key, n, perMin) {
    const m = Math.floor(this.now() / 60000), s = this.limits[key] || (this.limits[key] = [m, 0]);
    if (s[0] !== m) { s[0] = m; s[1] = 0; }
    const give = Math.max(0, Math.min(n, perMin - s[1])); s[1] += give; return give;
  }
  /** Tracker.Award: counted action with its XP, limited per minute and per hour. */
  award(stat, delta, maxOnce, perMin, xpEach) {
    if (delta <= 0) return 0;
    const n = this.limit(stat, Math.min(delta, maxOnce), perMin);
    if (!n) return 0;
    this.count(stat, n); this.bonus(n * xpEach);
    return n;
  }

  // ------------------------------------------------------------------ stats
  rollWeek() {
    const w = String(Math.floor((this.now() - EPOCH_UTC) / (7 * 86400000)));
    if (this.P.Week === w) return;
    this.P.Week = w; this.P.WeekStats = {}; this.P.WeekCleared = [];
  }
  count(stat, n) {
    if (n <= 0) return;
    this.P.Stats[stat] = this.stat(stat) + n;
    this.rollWeek();
    this.P.WeekStats[stat] = this.wstat(stat) + n;
    const t = this.today();
    if (this.P.DayStatsDay !== t) { this.P.DayStatsDay = t; this.P.DayStats = {}; }
    this.P.DayStats[stat] = (this.P.DayStats[stat] || 0) + n;
  }
  weekMax(stat, n) { this.rollWeek(); if (n > this.wstat(stat)) this.P.WeekStats[stat] = n; }
  max(stat, v) { if (v > this.stat(stat)) this.P.Stats[stat] = v; }
  run(name, at) {
    const last = this.stat(name + "_last"); let cur = this.stat(name + "_run");
    if (last === at) return;
    cur = last === at - 1 ? cur + 1 : 1;
    this.P.Stats[name + "_last"] = at; this.P.Stats[name + "_run"] = cur; this.max(name + "_best", cur);
  }

  /** One second of real editing (Tracker.Tick → Game.ActiveSecond + session records). */
  activeSecond(sessionSec, project) {
    const P = this.P, now = this.date(), today = dayKey(now);
    if (sessionSec > P.LongestSession) P.LongestSession = sessionSec;
    if (sessionSec % 60 === 0) this.weekMax("session", sessionSec / 60);
    if (P.Day !== today) { P.Day = today; P.DaySec = 0; this.trim(P.DayLog, 400); this.trim(P.DayXp, 400); }
    P.DaySec++; P.DayLog[today] = P.DaySec; P.ActiveSec++;
    const h = now.getHours();
    if (h < 5) P.OwlSec++;
    if (h >= 3 && h < 5 && P.LastNightDay !== today) { P.LastNightDay = today; this.count("night35", 1); }
    if (h >= 5 && h < 8) P.EarlySec++;
    if (h >= 22 || h < 5) this.count("night", 1 / 60);
    this.count("focus", 1 / 60);
    if (P.DaySec === 60 && !P.ActiveDays.includes(today)) {
      P.ActiveDays.push(today); while (P.ActiveDays.length > 3660) P.ActiveDays.shift();
      this.count("days", 1);
    }
    if (P.DaySec === 900 && P.LastStreakDay !== today) {
      const y = dayKey(addDays(now, -1));
      P.Streak = P.LastStreakDay === y ? P.Streak + 1 : 1;
      P.LastStreakDay = today;
      if (P.Streak > P.BestStreak) P.BestStreak = P.Streak;
    }
    if (project) {
      P.Projects[project] = (P.Projects[project] || 0) + 1;
      const keys = Object.keys(P.Projects);
      if (keys.length > 80) { keys.sort((a, b) => P.Projects[b] - P.Projects[a]); for (const k of keys.slice(60)) delete P.Projects[k]; }
    }
    if (now.getMonth() === 0 && now.getDate() === 1 && h === 0) this.max("newyear", 1);
  }
  sessionStarted(sessionDay) {
    // « Le Retour » : dernière journée de montage il y a 30 jours ou plus.
    const t = this.today(); let last = null;
    for (const d of this.P.ActiveDays) if (d !== t) last = d;
    if (last && (new Date(t + "T12:00:00") - new Date(last + "T12:00:00")) / 86400000 >= 30) this.max("comeback", 1);
  }
  sessionCounted() { this.P.Sessions++; }
  trim(obj, keep) { const k = Object.keys(obj).sort(); for (let i = 0; i < k.length - keep; i++) delete obj[k[i]]; }

  get currentStreak() {
    const P = this.P; if (!P.LastStreakDay) return 0;
    const y = dayKey(addDays(this.date(), -1));
    return P.LastStreakDay === this.today() || P.LastStreakDay === y ? P.Streak : 0;
  }

  // ------------------------------------------------------------------ week / day
  get weekIndex() { return Math.floor((this.now() - EPOCH_UTC) / (7 * 86400000)); }
  get weekLeftMs() { return EPOCH_UTC + 7 * 86400000 * (this.weekIndex + 1) - this.now(); }
  /** The 5 targets of this week: same shuffle as Game.ThisWeek (System.Random(week * 7919 + 13)). */
  get thisWeek() {
    const w = this.weekIndex;
    if (this._wk === w) return this._week;
    const l = POOL.slice(), r = new NetRandom(w * 7919 + 13);
    for (let i = l.length - 1; i > 0; i--) { const j = r.next(i + 1); const t = l[i]; l[i] = l[j]; l[j] = t; }
    const pick = [], stats = new Set();
    for (const x of l) if (pick.length < 5 && !stats.has(x.stat)) { stats.add(x.stat); pick.push(x); }
    pick.sort((a, b) => a.diff !== b.diff ? a.diff - b.diff : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this._wk = w; this._week = pick;
    return pick;
  }
  progress(w) { return Math.min(w.goal, Math.floor(this.wstat(w.stat) + 1e-9)); }
  get dayIndex() { const d = this.date(); return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH_UTC) / 86400000); }
  get daily() { return DAILY[(Math.imul(this.dayIndex, 2654435761) >>> 0) % DAILY.length]; }
  dayStat(stat) { return this.P.DayStatsDay === this.today() ? this.P.DayStats[stat] || 0 : 0; }
  get dailyDone() { return this.P.DailyDone === this.today(); }

  // ------------------------------------------------------------------ checks (every 5 s, like VEGAS)
  check(T) {
    T = T || ((fr, en) => en);
    this.rollWeek();
    const week = this.thisWeek;
    for (const w of week) {
      if (this.P.WeekCleared.includes(w.id) || this.wstat(w.stat) + 1e-9 < w.goal) continue;
      this.P.WeekCleared.push(w.id);
      const got = w.reward; this.addXp(got);
      if (this.P.WeekCleared.length === week.length) this.P.WeeksCleared++;
      this.onToast({ glyph: 0xE945, title: T("OBJECTIF VALIDÉ", "TARGET CLEARED"), text: T(w.fr, w.en), xp: got });
    }
    const d = this.daily;
    if (!this.dailyDone && this.dayStat(d.stat) + 1e-9 >= d.goal) {
      this.P.DailyDone = this.today();
      const got = d.reward; this.addXp(got);
      this.count("dailies", 1); this.run("daily", this.dayIndex);
      this.onToast({ glyph: 0xE930, title: T("QUÊTE DU JOUR VALIDÉE", "DAILY QUEST CLEARED"), text: T(d.fr, d.en), xp: got });
    }
    if (this.P.HoursGoal > 0 && this.P.GoalHitWeek !== this.P.Week && this.wstat("focus") / 60 >= this.P.HoursGoal) {
      this.P.GoalHitWeek = this.P.Week; this.count("goals", 1); this.run("goal", this.weekIndex);
      this.onToast({ glyph: 0xE916, title: T("OBJECTIF PERSONNEL ATTEINT", "PERSONAL GOAL REACHED"), text: this.P.HoursGoal + " h", xp: 0 });
    }
    for (let pass = 0; pass < 2; pass++) for (const a of this.ACH) {
      if (this.P.Unlocked[a.id]) continue;
      let v = 0; try { v = a.v(this.P); } catch (e) { continue; }
      if (v + 1e-9 < a.goal) continue;
      this.P.Unlocked[a.id] = this.unix();
      this.addXp(a.reward);
      this.onToast({ glyph: a.glyph, title: T("SUCCÈS DÉBLOQUÉ", "ACHIEVEMENT UNLOCKED"), text: T(a.fr, a.en), xp: a.reward, ach: a.id });
    }
  }
  /** Achievements the account already has (server list): marked unlocked without reward, so none is paid twice. */
  adoptUnlocked(ids) {
    const t = this.unix();
    for (const id of ids || []) if (!this.P.Unlocked[id] && this.ACH.some(a => a.id === id)) this.P.Unlocked[id] = t - 86400 * 2;
  }
  achById(id) { return this.ACH.find(a => a.id === id) || null; }
  chosenBadges() {
    const P = this.P, l = [];
    if (P.Badges) { for (const b of P.Badges) if (P.Unlocked[b] && l.length < 3) l.push(b); return l; }
    return this.ACH.filter(a => P.Unlocked[a.id]).sort((a, b) => b.reward - a.reward).slice(0, 3).map(a => a.id);
  }
}

module.exports = { Game, CATS, achCat, achTier, dayKey, addDays, newProfile, POOL, DAILY };

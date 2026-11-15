// Money counter (VEGAS MoneyUi, hidden feature: right click → "Money counter…"): hourly rate × active editing time of the
// session (same timer as the XP, pauses not counted), shown under the session XP. A rate for all projects, or one for the
// open project. Rates and amounts stay on this PC: nothing is sent to the server or shown to other players.
"use strict";
const CURRENCIES = [
  ["EUR", "€", false, 2, "Euro", "Euro"],
  ["USD", "$", true, 2, "Dollar américain", "US dollar"],
  ["GBP", "£", true, 2, "Livre sterling", "British pound"],
  ["CAD", "CA$", true, 2, "Dollar canadien", "Canadian dollar"],
  ["CHF", "CHF", false, 2, "Franc suisse", "Swiss franc"],
  ["AUD", "A$", true, 2, "Dollar australien", "Australian dollar"],
  ["NZD", "NZ$", true, 2, "Dollar néo-zélandais", "New Zealand dollar"],
  ["VND", "₫", false, 0, "Dong vietnamien", "Vietnamese dong"],
  ["MGA", "Ar", false, 0, "Ariary malgache", "Malagasy ariary"],
  ["UAH", "₴", false, 2, "Hryvnia ukrainienne", "Ukrainian hryvnia"],
  ["RUB", "₽", false, 2, "Rouble russe", "Russian ruble"],
  ["PLN", "zł", false, 2, "Złoty polonais", "Polish złoty"],
  ["CZK", "Kč", false, 2, "Couronne tchèque", "Czech koruna"],
  ["HUF", "Ft", false, 0, "Forint hongrois", "Hungarian forint"],
  ["RON", "lei", false, 2, "Leu roumain", "Romanian leu"],
  ["SEK", "kr", false, 2, "Couronne suédoise", "Swedish krona"],
  ["NOK", "kr", false, 2, "Couronne norvégienne", "Norwegian krone"],
  ["DKK", "kr", false, 2, "Couronne danoise", "Danish krone"],
  ["TRY", "₺", true, 2, "Livre turque", "Turkish lira"],
  ["MAD", "DH", false, 2, "Dirham marocain", "Moroccan dirham"],
  ["DZD", "DA", false, 2, "Dinar algérien", "Algerian dinar"],
  ["TND", "DT", false, 3, "Dinar tunisien", "Tunisian dinar"],
  ["XOF", "FCFA", false, 0, "Franc CFA (Afrique de l'Ouest)", "CFA franc (West Africa)"],
  ["XAF", "FCFA", false, 0, "Franc CFA (Afrique centrale)", "CFA franc (Central Africa)"],
  ["NGN", "₦", true, 2, "Naira nigérian", "Nigerian naira"],
  ["ZAR", "R", true, 2, "Rand sud-africain", "South African rand"],
  ["EGP", "E£", true, 2, "Livre égyptienne", "Egyptian pound"],
  ["AED", "AED", false, 2, "Dirham des Émirats", "UAE dirham"],
  ["SAR", "SAR", false, 2, "Riyal saoudien", "Saudi riyal"],
  ["ILS", "₪", true, 2, "Shekel israélien", "Israeli shekel"],
  ["INR", "₹", true, 2, "Roupie indienne", "Indian rupee"],
  ["PKR", "Rs", true, 0, "Roupie pakistanaise", "Pakistani rupee"],
  ["BDT", "৳", true, 0, "Taka bangladais", "Bangladeshi taka"],
  ["JPY", "¥", true, 0, "Yen japonais", "Japanese yen"],
  ["CNY", "¥", true, 2, "Yuan chinois", "Chinese yuan"],
  ["KRW", "₩", true, 0, "Won sud-coréen", "South Korean won"],
  ["IDR", "Rp", true, 0, "Roupie indonésienne", "Indonesian rupiah"],
  ["PHP", "₱", true, 2, "Peso philippin", "Philippine peso"],
  ["THB", "฿", true, 2, "Baht thaïlandais", "Thai baht"],
  ["MYR", "RM", true, 2, "Ringgit malaisien", "Malaysian ringgit"],
  ["SGD", "S$", true, 2, "Dollar de Singapour", "Singapore dollar"],
  ["HKD", "HK$", true, 2, "Dollar de Hong Kong", "Hong Kong dollar"],
  ["BRL", "R$", true, 2, "Real brésilien", "Brazilian real"],
  ["MXN", "MX$", true, 2, "Peso mexicain", "Mexican peso"],
  ["ARS", "AR$", true, 0, "Peso argentin", "Argentine peso"],
  ["COP", "COL$", true, 0, "Peso colombien", "Colombian peso"],
  ["CLP", "CLP$", true, 0, "Peso chilien", "Chilean peso"],
  ["PEN", "S/", true, 2, "Sol péruvien", "Peruvian sol"]
].map(([code, sym, pre, dec, fr, en]) => ({ code, sym, pre, dec, fr, en }));
const EUR = "FR BE DE ES IT PT NL LU AT IE FI GR SK SI EE LV LT HR CY MT AD MC SM VA ME XK RE GP MQ GF YT PM".split(" ");
const PAIRS = "US USD,GB GBP,CA CAD,CH CHF,LI CHF,AU AUD,NZ NZD,VN VND,MG MGA,UA UAH,RU RUB,PL PLN,CZ CZK,HU HUF,RO RON,SE SEK,NO NOK,DK DKK,TR TRY,MA MAD,DZ DZD,TN TND,NG NGN,ZA ZAR,EG EGP,AE AED,SA SAR,IL ILS,IN INR,PK PKR,BD BDT,JP JPY,CN CNY,KR KRW,ID IDR,PH PHP,TH THB,MY MYR,SG SGD,HK HKD,BR BRL,MX MXN,AR ARS,CO COP,CL CLP,PE PEN".split(",");
const COUNTRY = {}; EUR.forEach(c => { COUNTRY[c] = "EUR"; }); "SN CI ML BF NE TG BJ GW".split(" ").forEach(c => { COUNTRY[c] = "XOF"; }); "CM GA CG TD CF GQ".split(" ").forEach(c => { COUNTRY[c] = "XAF"; });
PAIRS.forEach(p => { COUNTRY[p.slice(0, 2)] = p.slice(3); });

/** Currency of a code; without a choice: the player's country's, else the euro. */
function curOf(code, country) {
  if (!code) code = COUNTRY[country || ""] || "EUR";
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}
/** Rate and currency that apply now: the open project's if it has one, else the general rate. */
function rateFor(P, project) {
  const pr = project && P.ProjectRates ? Object.keys(P.ProjectRates).find(k => k.toLowerCase() === project.toLowerCase()) : null;
  if (pr) return { rate: P.ProjectRates[pr].Rate || 0, cur: P.ProjectRates[pr].Cur || "", project: true };
  return { rate: P.MoneyRate || 0, cur: P.MoneyCur || "", project: false };
}
function group(intPart, sep) { return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep); }
/** "47,22 €" / "$47.22" (French: comma decimals, narrow space thousands). */
function format(v, code, country, fr, cents) {
  const c = curOf(code, country), dec = cents === false ? (Math.abs(v - Math.round(v)) < 1e-9 ? 0 : c.dec) : c.dec;
  const [i, d] = Math.abs(v).toFixed(dec).split(".");
  const n = (v < 0 ? "-" : "") + group(i, fr ? "\u202f" : ",") + (d ? (fr ? "," : ".") + d : "");
  return c.pre ? c.sym + n : n + " " + c.sym;
}
/** Animation step: a round amount (1, 2 or 5 × 10^n) reached about every 3 min; never under 1 for currencies without cents. */
function step(rate, code, country) {
  const target = Math.max(rate / 20, 1e-6), b = Math.pow(10, Math.floor(Math.log10(target))), m = target / b;
  return Math.max(curOf(code, country).dec === 0 ? 1 : 0.01, (m >= 5 ? 5 : m >= 2 ? 2 : 1) * b);
}
module.exports = { CURRENCIES, curOf, rateFor, format, step };
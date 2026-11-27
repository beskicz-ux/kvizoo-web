// The quiz start (2026-11-26): for visitors who arrive from a reel on a phone, with no slides at hand. Penny asks five
// one-tap questions, then shows a study plan worked out from the answers (the same arithmetic as the exam-date step,
// forecast.js studyPlan), and only then asks for the slides. Opened by #/q, or by a ?c=<name> link in a bio
// (kvizoo.com/app/?c=<name>); the name stays in the address, so the visit counter records which link the visit came from.
// Nothing here is sent to pc-api: the answers live in pc.quiz on the device and only shape the plan screen.
import { $, $$, view, esc, store, sfx, api } from "./util.js";
import { t, lang } from "./i18n.js";
import { BACK, CLOSE } from "./ui.js";
import { studyPlan, ACCEPT, PACE_GOOD } from "./forecast.js";
import { puppet } from "./puppet.js";

// Icons (Marek, 2026-11-27, after looking at how Duolingo and Finch draw answer rows): each is a small object in its real
// colours with nothing behind it, the way popular apps do it. One family: every shape filled and rounded, flat, seen
// straight on, paper parts with a darker lower edge. The answers of a scale question keep one object and change how much
// of it is lit (one, two, three weeks; a quarter, half, whole hour); "I don't know" is the same object with a question mark.
// Colours only from the Flat UI "American" palette (flatuicolors.com/palette/us); fixed, so they hold on both themes.
// No white or grey "paper": it glared on the dark theme and washed out on the light one (Marek, 2026-11-27). Each object is
// the light and the strong tone of one colour, with small details in white, so it holds on both.
const RED = "#FF7675", CRIMSON = "#D63031", ORANGE = "#E17055", YELLOW = "#FDCB6E", MINT = "#55EFC4", GREEN = "#00B894", TEAL = "#00CEC9", SKY = "#74B9FF", BLUE = "#0984E3",
  LILAC = "#A29BFE", PURPLE = "#6C5CE7", PINK = "#FD79A8", PEACH = "#FAB1A0", GREY = "#B2BEC3", INK = "#636E72", WHITE = "#fff";
const svg = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const box = (x, y, w, h, r, c, more = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"${more}/>`;
const ln = (d, w, c) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const fl = (d, c, o = 1) => `<path d="${d}" fill="${c}" opacity="${o}"/>`;
const at = (inner, x, y, k) => `<g transform="translate(${x} ${y}) scale(${k}) translate(-12 -12.700)">${inner}</g>`;
const ask = (x, y, k, c = WHITE) => at(ln("M9.200 9.600a2.900 2.900 0 1 1 4.300 2.500c-.9.5-1.500 1-1.500 2.100", 2.8, c) + `<circle cx="12" cy="17.700" r="1.600" fill="${c}"/>`, x, y, k);
// a calendar page in the light tone, its header and the weeks left until the exam (lit of 3) in the strong one, or a question mark
const cal = (light, strong, lit) => box(7, 2.6, 2.2, 4.6, 1.1, GREY) + box(14.8, 2.6, 2.2, 4.6, 1.1, GREY) + box(3, 5, 18, 16, 4, light) + fl("M3 10.500V9a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v1.500z", strong)
  + (lit ? [12.6, 15.2, 17.8].map((y, i) => box(6, y, 12, 1.7, .85, i < lit ? strong : WHITE, i < lit ? "" : ` opacity=".5"`)).join("") : ask(12, 15.8, .5));
// a lecture slide (they lie on their side): the front one with a heading and two lines, the ones behind it plain
const slide = (x, y, c = SKY) => box(x, y, 14, 10, 2.4, c);
const slideText = (x, y) => box(x + 2, y + 2, 6, 1.8, .9, BLUE) + box(x + 2, y + 5, 10, 1.3, .65, WHITE, ` opacity=".75"`) + box(x + 2, y + 7.2, 7, 1.3, .65, WHITE, ` opacity=".75"`);
const big = inner => `<g transform="translate(12 12.500) scale(1.3) translate(-12 -11.500)">${inner}</g>`;
// a clock: a strong rim, a light face and the part of the hour that is taken
const clock = (light, strong, inner) => `<circle cx="12" cy="12" r="10" fill="${strong}"/><circle cx="12" cy="12" r="7.800" fill="${light}"/>${inner}`;
const ICONS = {
  when_week: svg(cal(RED, CRIMSON, 1)),
  when_weeks: svg(cal(YELLOW, ORANGE, 2)),
  when_month: svg(cal(MINT, GREEN, 3)),
  when_idk: svg(cal(LILAC, PURPLE, 0)),
  size_s: svg(big(slide(5, 6.5) + slideText(5, 6.5))),
  size_m: svg(slide(7.5, 4.5, BLUE) + slide(3.5, 8.5) + slideText(3.5, 8.5)),
  size_l: svg(slide(8, 2.5, PURPLE) + slide(5, 6, BLUE) + slide(2, 9.5) + slideText(2, 9.5)),
  size_idk: svg(big(slide(5, 6.5, LILAC) + ask(12, 11.5, .5))),
  // an open book, a pencil, two flashcards with a tick, a seedling (not started yet)
  how_reread: svg(box(1.5, 6.5, 21, 13.5, 3, BLUE) + box(3, 5, 8.3, 13, 2, SKY) + box(12.7, 5, 8.3, 13, 2, SKY)
    + [8.3, 10.9, 13.5].map(y => box(4.8, y, 4.7, 1.2, .6, WHITE, ` opacity=".75"`) + box(14.5, y, 4.7, 1.2, .6, WHITE, ` opacity=".75"`)).join("")),
  how_notes: svg(`<g transform="rotate(-45 12 12)">` + box(1.5, 9.3, 5, 5.4, 1.8, PINK) + box(5, 9.3, 2.4, 5.4, 0, GREY) + box(7.4, 9.3, 9.6, 5.4, 0, YELLOW) + fl("M17 9.300l5.200 2.200a.5.5 0 0 1 0 1L17 14.700z", PEACH) + fl("M20.300 10.700l1.900.8a.5.5 0 0 1 0 1l-1.900.8z", INK) + `</g>`),
  how_quiz: svg(box(8, 3.5, 12, 15, 2.6, PURPLE, ` transform="rotate(9 14 11)"`) + `<g transform="rotate(-7 10 13.500)">` + box(4, 6, 12, 15, 2.6, LILAC) + ln("M7 13.700l2.200 2.300 4-4.600", 2.3, WHITE) + `</g>`),
  how_none: svg(box(5.5, 18, 13, 3.6, 1.8, ORANGE) + box(11.1, 10, 1.8, 9, .9, GREEN) + fl("M12 13.500C7.500 13.500 4.500 11 4 6.500c4.500 0 7.500 2.500 8 7z", GREEN) + fl("M12 10.500c0-4.500 3-7 8-7 0 4.500-3 7-8 7z", MINT)),
  time_15: svg(clock(SKY, BLUE, fl("M12 12V4.200a7.800 7.800 0 0 1 7.800 7.800z", BLUE))),
  time_30: svg(clock(SKY, BLUE, fl("M12 4.200a7.800 7.800 0 0 1 0 15.600z", BLUE))),
  time_60: svg(`<circle cx="12" cy="12" r="10" fill="${BLUE}"/>` + ln("M12 7.200V12l3.300 2", 2.2, WHITE)),
  time_var: svg(clock(LILAC, PURPLE, ln("M7 12.800c1.100-3.400 2.200-3.400 3.300 0s2.300 3.400 3.400 0 2.200-3.400 3.300 0", 2, WHITE))),
  // a thought that fades, the moon of the last night, a signpost, a pile of books
  pain_forget: svg(`<g fill="${SKY}"><circle cx="8.500" cy="10.500" r="4.500"/><circle cx="13.500" cy="7.800" r="5"/><circle cx="17.800" cy="11" r="4"/><rect x="4.500" y="9.500" width="17.300" height="6" rx="3"/><circle cx="9" cy="18.800" r="1.800" opacity=".7"/><circle cx="5.300" cy="21.200" r="1.200" opacity=".45"/></g>`),
  pain_late: svg(fl("M20.500 15A9 9 0 0 1 9 3.500a9 9 0 1 0 11.500 11.500z", YELLOW) + fl("M17 3l1 2.500 2.500 1-2.500 1-1 2.500-1-2.500-2.500-1 2.500-1z", YELLOW)),
  pain_start: svg(box(11, 2.5, 2, 19.5, 1, GREY) + fl("M5.500 4h9.800l3.200 3-3.200 3H5.500a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z", BLUE) + fl("M18.500 11.500H8.700l-3.200 3 3.200 3h9.800a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1z", YELLOW)),
  pain_much: svg(box(3.5, 17.4, 17, 4, 1.6, RED) + box(5.5, 13.2, 14, 4, 1.6, BLUE) + box(3, 9, 15.5, 4, 1.6, YELLOW) + box(6.5, 4.800, 12.5, 4, 1.6, GREEN) + box(7.500, 1.600, 9, 3, 1.4, PURPLE, ` transform="rotate(-8 12 3)"`)),
  // the plan's rows: the daily load, the time it fits, and how often each slide comes back
  load: svg(cal(LILAC, PURPLE, 3)),
  fit: svg(clock(MINT, GREEN, ln("M8.500 12.300l2.400 2.500 4.600-5.200", 2.3, WHITE))),
  rep: svg(ln("M19 8.500A7.500 7.500 0 0 0 5.300 9.700M5 15.500a7.500 7.500 0 0 0 13.700-1.200", 2.8, TEAL) + ln("M19.800 4.500v4.500h-4.500M4.200 19.500V15h4.500", 2.8, TEAL)),
};

// Each question: its key in pc.quiz, then the answers. `days` and `pages` feed the plan; `min` is the time the student has.
const QUESTIONS = [
  { k: "when", opts: [{ v: "week", days: 7 }, { v: "weeks", days: 18 }, { v: "month", days: 35 }, { v: "idk", days: 21 }] },
  { k: "size", opts: [{ v: "s", pages: 80 }, { v: "m", pages: 200 }, { v: "l", pages: 400 }, { v: "idk", pages: 200 }] },
  { k: "how", opts: [{ v: "reread" }, { v: "notes" }, { v: "quiz" }, { v: "none" }] },
  { k: "time", opts: [{ v: "15", min: 15 }, { v: "30", min: 30 }, { v: "60", min: 60 }, { v: "var" }] },
  { k: "pain", opts: [{ v: "forget" }, { v: "late" }, { v: "start" }, { v: "much" }] },
];
const N = QUESTIONS.length;
const UPLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg>`;
const MAIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 8l8 5.500L20 8"/></svg>`;
const SPIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M12 4a8 8 0 1 0 8 8"/></svg>`;

const quiz = () => store.get("quiz", null) || {};
const answers = () => quiz().a || {};
const optOf = (q, a) => q.opts.find(o => o.v === a[q.k]);
// The first question still without an answer (1-based), or 0 when all five are answered.
const firstOpen = a => { const i = QUESTIONS.findIndex(q => !optOf(q, a)); return i < 0 ? 0 : i + 1; };

// A ?c=<name> link: the name is kept with the answers. Returns the name, or "" when the address has none.
function campaignFrom(search) {
  const c = (new URLSearchParams(search).get("c") || "").toLowerCase();
  return /^[a-z0-9-]{1,24}$/.test(c) ? c : "";
}
// A ?q=<when>.<size>.<how>.<time>.<pain> link from the plan email: the five answers, so the same plan opens on another
// device. Returns the answers, or null when the address has none or any of the five isn't a known answer.
function planFrom(search) {
  const vs = (new URLSearchParams(search).get("q") || "").split(".");
  if (vs.length !== N) return null;
  const a = Object.fromEntries(QUESTIONS.map((q, i) => [q.k, vs[i]]));
  return firstOpen(a) ? null : a;
}
function quizArrived(search) {
  const c = campaignFrom(search), a = planFrom(search); if (!c && !a) return false;
  store.set("quiz", { ...quiz(), ...(c ? { c } : {}), ...(a ? { a, viaMail: true } : {}) });
  return true;
}

// The contact asked for before the plan (Marek, 2026-11-26: "předem se zeptej na email nebo číslo, ať máme kontakt"):
// an email, or a phone number of 9 to 15 digits. The same two checks as pc-api's lead action.
function contactOf(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s.length <= 200 && /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(s)) return { v: s, kind: "email" };
  const d = s.replace(/[\s()./-]/g, "");
  return /^\+?\d{9,15}$/.test(d) ? { v: d, kind: "phone" } : null;
}
// The contact box reads what is typed (Marek, 2026-11-27): digits mean a phone number, so the country picker shows with
// its calling code (Czechia first) and the digits are spaced in threes; a letter means an email and the picker goes away.
// [region, calling code, national length if it is fixed]. Names come from the browser (Intl.DisplayNames), flags are emoji.
const DIALS = [["CZ", "420", 9], ["SK", "421", 9], ["PL", "48", 9], ["DE", "49"], ["AT", "43"], ["UA", "380", 9], ["GB", "44"], ["US", "1", 10],
  ["FR", "33", 9], ["ES", "34", 9], ["IT", "39"], ["PT", "351", 9], ["BR", "55"], ["TR", "90", 10], ["RU", "7", 10], ["IN", "91", 10], ["ID", "62"],
  ["VN", "84"], ["JP", "81"], ["KR", "82"], ["CN", "86", 11], ["BD", "880", 10], ["SA", "966", 9], ["EG", "20", 10]];
const DIAL_OF_LANG = { sk: "SK", pl: "PL", de: "DE", uk: "UA", fr: "FR", es: "ES", it: "IT", pt: "PT", tr: "TR", ru: "RU", hi: "IN", id: "ID", vi: "VN", ja: "JP", ko: "KR", zh: "CN", bn: "BD", ar: "SA" };
// Round flags drawn here (Marek's reference, 2026-11-27: one field with a round flag, the code and the number, and a list
// with a search under it). Flag emoji are not used: Windows has none. Simplified, 30 x 30, cut to a circle by CSS.
const bands = (cs, upright) => cs.map((c, i) => { const a = 30 / cs.length; return upright ? `<rect x="${i * a}" width="${a + .1}" height="30" fill="${c}"/>` : `<rect y="${i * a}" width="30" height="${a + .1}" fill="${c}"/>`; }).join("");
const full = c => `<rect width="30" height="30" fill="${c}"/>`;
const star = (x, y, r, c) => `<polygon fill="${c}" points="${Array.from({ length: 10 }, (_, i) => { const a = Math.PI * (i / 5 - .5), k = i % 2 ? r * .4 : r; return (x + Math.cos(a) * k).toFixed(1) + "," + (y + Math.sin(a) * k).toFixed(1); }).join(" ")}"/>`;
const FLAGS = {
  CZ: bands(["#fff", "#D7141A"]) + `<path d="M0 0l15 15L0 30z" fill="#11457E"/>`,
  SK: bands(["#fff", "#0B4EA2", "#EE1C25"]) + `<path d="M6.5 8h9v8c0 4-4.5 6-4.5 6s-4.5-2-4.5-6z" fill="#EE1C25" stroke="#fff" stroke-width="1.2"/><path d="M11 10.5v8M9 13h4M8.5 15.5h5" stroke="#fff" stroke-width="1.1"/>`,
  PL: bands(["#fff", "#DC143C"]), DE: bands(["#000", "#DD0000", "#FFCE00"]), AT: bands(["#ED2939", "#fff", "#ED2939"]), UA: bands(["#0057B7", "#FFD700"]),
  GB: full("#012169") + `<path d="M0 0l30 30M30 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l30 30M30 0L0 30" stroke="#C8102E" stroke-width="2.4"/><path d="M15 0v30M0 15h30" stroke="#fff" stroke-width="9"/><path d="M15 0v30M0 15h30" stroke="#C8102E" stroke-width="5"/>`,
  US: bands(["#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234"]) + `<rect width="15" height="17.2" fill="#3C3B6E"/>`,
  FR: bands(["#0055A4", "#fff", "#EF4135"], 1), IT: bands(["#009246", "#fff", "#CE2B37"], 1),
  ES: full("#AA151B") + `<rect y="7.5" width="30" height="15" fill="#F1BF00"/>`,
  PT: full("#FF0000") + `<rect width="12" height="30" fill="#006600"/><circle cx="12" cy="15" r="4.5" fill="#FFE000"/>`,
  BR: full("#009C3B") + `<path d="M15 5l12 10-12 10L3 15z" fill="#FFDF00"/><circle cx="15" cy="15" r="5" fill="#002776"/>`,
  TR: full("#E30A17") + `<circle cx="12.5" cy="15" r="6" fill="#fff"/><circle cx="14.2" cy="15" r="4.8" fill="#E30A17"/>` + star(20, 15, 2.8, "#fff"),
  RU: bands(["#fff", "#0039A6", "#D52B1E"]),
  IN: bands(["#FF9933", "#fff", "#138808"]) + `<circle cx="15" cy="15" r="3.2" fill="none" stroke="#000080" stroke-width="1"/>`,
  ID: bands(["#CE1126", "#fff"]), VN: full("#DA251D") + star(15, 15, 7, "#FFFF00"),
  JP: full("#fff") + `<circle cx="15" cy="15" r="6.5" fill="#BC002D"/>`,
  KR: full("#fff") + `<path d="M9 15a6 6 0 0112 0z" fill="#CD2E3A"/><path d="M21 15a6 6 0 01-12 0z" fill="#0047A0"/><path d="M5 8l4-3M21 25l4-3M21 5l4 3M5 22l4 3" stroke="#000" stroke-width="2"/>`,
  CN: full("#DE2910") + star(10, 11, 5, "#FFDE00") + star(18, 6, 1.6, "#FFDE00") + star(21, 9.5, 1.6, "#FFDE00") + star(21, 14, 1.6, "#FFDE00") + star(18, 17.5, 1.6, "#FFDE00"),
  BD: full("#006A4E") + `<circle cx="13.5" cy="15" r="6.5" fill="#F42A41"/>`,
  SA: full("#006C35") + `<rect x="9" y="10.5" width="12" height="4.5" rx="1.2" fill="#fff"/><rect x="8" y="18" width="14" height="1.6" rx=".8" fill="#fff"/>`,
  EG: bands(["#CE1126", "#fff", "#000"]) + `<circle cx="15" cy="15" r="2.2" fill="#C09300"/>`,
};
const flagSvg = cc => `<svg class="qz-flag" viewBox="0 0 30 30" aria-hidden="true">${FLAGS[cc] || full("#888")}</svg>`;
const fold = s => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const CHEV = `<svg class="qz-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const TICK = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.6 3.6 7.4-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const LENS = `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const looksPhone = s => /^[\d\s+()./-]+$/.test(s) && /[\d+]/.test(s);
const threes = d => d.replace(/(\d{3})(?=\d)/g, "$1 ");
// What a typed phone number is: the country it names itself ("+421…" or "00421…"), else the picked one, and the digits after
// the code. A "+" number whose code is not in the list stays as typed (cc null).
function phoneParts(raw, picked) {
  const s = String(raw || "").trim(), d = s.replace(/\D/g, "");
  const intl = s.startsWith("+") ? d : s.startsWith("00") ? d.slice(2) : null;
  if (intl == null) return { cc: picked, nat: d };
  const hit = DIALS.filter(([, code]) => intl.startsWith(code)).sort((a, b) => b[1].length - a[1].length)[0];
  return hit ? { cc: hit[0], nat: intl.slice(hit[1].length) } : { cc: null, nat: intl };
}
// The number to send: the code and the digits, or nothing when the length is wrong for that country.
function phoneOf(cc, nat) {
  const [, code, len] = DIALS.find(x => x[0] === cc) || [];
  if (!code) return contactOf("+" + nat);
  return (len ? nat.length === len : nat.length >= 6 && nat.length <= 12) ? contactOf("+" + code + nat) : null;
}
// A visitor who left a contact here, or came from the emailed link (their address is already known), goes to the plan.
const contactKnown = () => { const q = quiz(); return !!(q.contact || q.viaMail); };
const lead = (contact, link) => api("lead", { contact, link, answers: answers(), c: quiz().c || "", lang: lang() });

// The plan from the answers, in the exam-date step's own numbers. Minutes are rounded to 5, never under 5.
function quizPlan(a) {
  const when = optOf(QUESTIONS[0], a), size = optOf(QUESTIONS[1], a), time = optOf(QUESTIONS[3], a);
  const pages = size?.pages || 200, days = when?.days || 21;
  const p = studyPlan(pages, days);
  return { pages, days, minutes: Math.max(5, Math.round(p.perDay / 5) * 5), repeats: Math.round(p.repeats), sprint: p.perDay > PACE_GOOD, have: time?.min || 0, guessedDays: when?.v === "idk", guessedPages: size?.v === "idk" };
}

// The bar's width at each screen (Marek, 2026-11-27): it starts with something in it, the first two answers bring it to
// half, and every step after that adds less, so the start feels quick and the contact step is nearly the end.
// One bar for the whole start (Marek, same day, later): the questions, the contact, then the setup steps in app.js (files,
// exam date, tutor) all share it. It starts 15 % full and ends at 95 %; each step adds less than the one before.
const BAR = { 1: 15, 2: 34, 3: 50, 4: 64, 5: 75, [N + .5]: 84, [N + 1]: 90 };
const SETUP_BAR = { files: 90, date: 92, tutor: 94, source: 95 };
let lastBar = BAR[1]; // the bar's width on the screen before, so it grows from there instead of jumping
function head(step, back) {
  const now = BAR[step] ?? Math.round((step - 1) / N * 100);
  return `<div class="ob-hd"><button class="ob-bk" id="qzBack" aria-label="${t("back")}">${back ? BACK : CLOSE}</button>${barHtml(now)}<span class="ob-bkpad"></span></div>`;
}
// The bar itself, growing from where the screen before left it. app.js draws the setup steps' bar with it (setupBar).
function barHtml(now) {
  const h = `<div class="ob-bar qz-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${now}"><i style="width:${Math.min(lastBar, now)}%"></i></div>`;
  requestAnimationFrame(() => { const i = $(".qz-bar i"); if (i) i.style.width = now + "%"; });
  lastBar = now;
  return h;
}
const setupBar = step => SETUP_BAR[step] ? barHtml(SETUP_BAR[step]) : "";
function say(title, state) {
  const p = puppet({ size: 92, state });
  queueMicrotask(() => $("#qzPenny")?.replaceChildren(p.el)); // right after the caller writes the screen; a frame callback never runs in a background tab
  return { p, html: `<div class="ob-say"><div class="ob-say-art" id="qzPenny"></div><h1 class="ob-bub" id="obTitle">${title}</h1></div>` };
}

function viewQuestion(step, ctx) {
  const q = QUESTIONS[step - 1], a = answers();
  let picked = optOf(q, a)?.v || "", leaving = false;
  const s = say(esc(t("qzQ_" + q.k)), "talk");
  view().innerHTML = `<div class="ob qz">${head(step, step > 1)}${s.html}
    ${step === 1 ? `<p class="ob-sub">${esc(t("qzSub"))}</p>` : ""}
    <div class="ob-body"><div class="src-grid" id="qzOpts" role="radiogroup" aria-labelledby="obTitle">${q.opts.map(o => `<button type="button" class="src" role="radio" aria-checked="${picked === o.v}" data-v="${o.v}"><span class="src-i" aria-hidden="true">${ICONS[q.k + "_" + o.v]}</span><b>${esc(t(`qz_${q.k}_${o.v}`))}</b></button>`).join("")}</div></div>
    ${step === 1 ? `<p class="ob-legal qz-have"><a href="#/login">${esc(t("welcomeHave"))}</a></p>` : ""}</div>`;
  const talk = setTimeout(() => s.p.setState("idle"), 1100); // Penny says the question, then waits
  $("#qzBack").onclick = () => ctx.nav(step > 1 ? "#/q/" + (step - 1) : "#/");
  const box = $("#qzOpts");
  box.onclick = e => {
    const b = e.target.closest("[data-v]"); if (!b || leaving) return;
    leaving = true; picked = b.dataset.v; clearTimeout(talk);
    $$("#qzOpts .src").forEach(x => x.setAttribute("aria-checked", x.dataset.v === picked));
    sfx.flip(); s.p.setState("correct");
    const cur = quiz(); store.set("quiz", { ...cur, a: { ...cur.a, [q.k]: picked } });
    // a short beat so the tap shows as picked before the next question comes
    setTimeout(() => step < N ? ctx.nav("#/q/" + (step + 1)) : !contactKnown() ? ctx.nav("#/q/contact") : quiz().viaMail ? ctx.nav("#/q/plan") : ctx.takeFiles([]).catch(() => ctx.nav("#/q/contact")), 420);
  };
  box.onkeydown = e => {
    const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]; if (!k) return;
    e.preventDefault();
    const all = $$("#qzOpts .src"), at = all.indexOf(document.activeElement);
    all[(Math.max(0, at) + k + all.length) % all.length].focus();
  };
}

// Between the last question and the plan. The contact goes to pc-api with the answers; if that call fails or is slow the
// plan still opens (the visitor did their part) and the plan screen sends it once more.
function viewContact(ctx) {
  const s = say(`<small class="qz-kick">${esc(t("qzCKick"))}</small>${esc(t("qzCTitle"))}`, "talk");
  const legal = esc(t("qzCLegal")).replace("%", `<a href="#/privacy">${esc(t("qzCLegalLink"))}</a>`);
  let names; try { names = new Intl.DisplayNames([lang()], { type: "region" }); } catch (e) { names = null; }
  const nameOf = cc => names?.of(cc) || cc;
  let cc = DIAL_OF_LANG[lang()] || "CZ", tel = false;
  // the list starts with the visitor's own country, then Czechia, Slovakia and the United States (Marek, 2026-11-27), then the rest by name
  const first = [cc, ...["CZ", "SK", "US"].filter(c => c !== cc)], top = c => { const i = first.indexOf(c); return i < 0 ? 9 : i; };
  const rows = DIALS.map(([c, code]) => [c, code, nameOf(c)]).sort((a, b) => top(a[0]) - top(b[0]) || a[2].localeCompare(b[2], lang()))
    .map(([c, code, n]) => `<li role="option" tabindex="-1" data-cc="${c}" data-k="${esc(fold(n))} ${code} ${c.toLowerCase()}">${flagSvg(c)}<span>${esc(n)}</span><em>+${code}</em></li>`).join("");
  view().innerHTML = `<div class="ob qz qz-contact">${head(N + .5, true)}${s.html}
    <p class="ob-sub">${esc(t("qzCSub"))}</p>
    <form class="ob-body" id="qzCForm" novalidate>
      <div class="qz-field"><button type="button" class="qz-cc" id="qzCC" hidden aria-haspopup="listbox" aria-expanded="false" aria-controls="qzList"><span id="qzCCf"></span>${CHEV}<b id="qzCCv"></b></button>
        <input class="ob-in" id="qzCIn" type="text" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="200" placeholder="${esc(t("qzCPh"))}" aria-label="${esc(t("qzCPh"))}" aria-describedby="err" value="${esc(quiz().contact?.v || "")}">
        <span class="qz-ok" id="qzOk" hidden>${TICK}</span></div>
      <div class="qz-pop" id="qzPop" hidden><label class="qz-find">${LENS}<input id="qzFind" type="text" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t("qzCFind"))}" aria-label="${esc(t("qzCFind"))}"></label>
        <ul class="qz-list" id="qzList" role="listbox" aria-label="${esc(t("qzCFind"))}">${rows}</ul></div>
      <p class="ob-err c" id="err" hidden role="alert"></p>
    </form>
    <div class="ob-foot"><button class="ld-b ld-go" id="qzCGo" type="submit" form="qzCForm">${esc(t("qzCGo"))}</button>
      <p class="ob-legal qz-legal">${legal}</p></div></div>`;
  const talk = setTimeout(() => s.p.setState("idle"), 1100);
  $("#qzBack").onclick = () => ctx.nav("#/q/" + N);
  const box = $("#qzCIn"), go = $("#qzCGo"), err = $("#err");
  const bad = () => { err.textContent = t("qzCBad"); err.hidden = false; box.setAttribute("aria-invalid", "true"); box.focus(); };
  const pick = $("#qzCC"), pop = $("#qzPop"), find = $("#qzFind"), list = $("#qzList"), okMark = $("#qzOk"), wrap = $(".qz-contact");
  const shown = () => $$("#qzList li").filter(li => !li.hidden);
  const mark = () => { okMark.hidden = !(tel ? phoneOf(cc, box.value.replace(/\D/g, "")) : contactOf(box.value)); };
  const showCc = () => {
    const code = DIALS.find(x => x[0] === cc)[1];
    $("#qzCCf").innerHTML = flagSvg(cc); $("#qzCCv").textContent = "+" + code; pick.setAttribute("aria-label", `${nameOf(cc)} +${code}`);
    $$("#qzList li").forEach(li => li.setAttribute("aria-selected", li.dataset.cc === cc));
  };
  // the country list: opens under the field with a search on top; a tap, Enter or the arrows pick, Escape or a tap outside shuts it
  const shut = () => { pop.hidden = true; pick.setAttribute("aria-expanded", "false"); };
  const filter = () => { const q = fold(find.value.trim()).replace(/^\+/, ""); $$("#qzList li").forEach(li => { li.hidden = !!q && !li.dataset.k.includes(q); }); };
  const choose = li => { cc = li.dataset.cc; showCc(); shut(); err.hidden = true; box.removeAttribute("aria-invalid"); mark(); box.focus(); };
  pick.onclick = () => { if (!pop.hidden) return shut(); pop.hidden = false; pick.setAttribute("aria-expanded", "true"); find.value = ""; filter(); list.scrollTop = 0; find.focus(); };
  find.oninput = filter;
  pop.onkeydown = e => {
    const all = shown(), at = all.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); shut(); pick.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); all[Math.min(all.length - 1, at + 1)]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (at <= 0) find.focus(); else all[at - 1].focus(); }
    else if (e.key === "Enter" || (e.key === " " && at >= 0)) { e.preventDefault(); const li = at >= 0 ? all[at] : all[0]; if (li) choose(li); }
  };
  list.onclick = e => { const li = e.target.closest("li"); if (li) choose(li); };
  const away = e => { if (!pop.isConnected) return document.removeEventListener("pointerdown", away); if (!pop.hidden && !pop.contains(e.target) && !pick.contains(e.target)) shut(); };
  document.addEventListener("pointerdown", away);
  // After every keystroke: which kind is it, and for a phone number the digits in threes with the caret kept on its digit.
  const sync = () => {
    const raw = box.value, was = tel;
    tel = looksPhone(raw);
    if (tel) {
      const p = phoneParts(raw, cc);
      if (p.cc) {
        const typedCode = p.cc !== cc || /^\s*(\+|00)/.test(raw), before = raw.slice(0, box.selectionStart ?? raw.length).replace(/\D/g, "").length;
        cc = p.cc;
        const nat = p.nat.slice(0, 12), shown = threes(nat);
        if (shown !== raw) {
          box.value = shown;
          let at = shown.length;
          if (!typedCode) { at = 0; for (let n = 0; at < shown.length && n < before; at++) if (/\d/.test(shown[at])) n++; }
          if (document.activeElement === box) box.setSelectionRange(at, at);
        }
      }
      tel = !!p.cc; // a "+" number with a code that is not in the list is sent as typed, without the picker
      if (p.cc) showCc();
    }
    pick.hidden = !tel; wrap.classList.toggle("tel", tel); if (!tel) shut(); mark();
    if (tel !== was) { box.autocomplete = tel ? "tel-national" : "email"; box.inputMode = tel ? "tel" : "email"; }
  };
  box.oninput = () => { err.hidden = true; box.removeAttribute("aria-invalid"); sync(); };
  sync();
  let busy = false;
  $("#qzCForm").onsubmit = async e => {
    e.preventDefault(); if (busy) return;
    const c = tel ? phoneOf(cc, box.value.replace(/\D/g, "")) : contactOf(box.value); if (!c) return bad();
    busy = true; clearTimeout(talk); go.classList.add("busy"); go.setAttribute("aria-busy", "true");
    let sent = false;
    try { await Promise.race([lead(c.v, false), new Promise((_, no) => setTimeout(() => no(new Error("slow")), 4000))]); sent = true; }
    catch (e2) { if (e2.code === "bad_contact") { busy = false; go.classList.remove("busy"); go.removeAttribute("aria-busy"); return bad(); } }
    store.set("quiz", { ...quiz(), contact: { ...c, sent } });
    window.pcHit?.("/app/q/contact-" + c.kind);
    sfx.flip(); s.p.setState("correct");
    // the contact first, then the files (Marek, 2026-11-27): the order opens here and the upload step is next
    try { await ctx.takeFiles([]); } catch (e3) { busy = false; go.classList.remove("busy"); go.removeAttribute("aria-busy"); ctx.fail(err, e3); }
  };
}

function viewPlan(ctx) {
  const a = answers(), p = quizPlan(a);
  const me = quiz().contact, viaMail = !!quiz().viaMail;
  // the contact didn't reach the server on the screen before (offline, slow): once more, quietly
  if (me && !me.sent) lead(me.v, false).then(() => store.set("quiz", { ...quiz(), contact: { ...me, sent: true } })).catch(() => { });
  const row = (icon, text) => `<li><span class="src-i" aria-hidden="true">${ICONS[icon]}</span><span>${esc(text)}</span></li>`;
  const rows = [
    row("load", t("qzRowLoad", { pages: p.pages, days: p.days })),
    row("rep", t("qzRowRep", { n: p.repeats })),
    row("how_" + a.how, t("qzHow_" + a.how)),
    row("pain_" + a.pain, t("qzPain_" + a.pain)),
    p.have ? row("fit", t(p.minutes <= p.have ? "qzFitOk" : "qzFitOver", { min: p.have })) : "",
  ].join("");
  const note = [t("qzNote"), p.guessedDays ? t("qzNoteDays") : "", p.guessedPages ? t("qzNotePages", { pages: p.pages }) : ""].filter(Boolean).join(" ");
  const s = say(`<small class="qz-kick">${esc(t("qzKick"))}</small>${esc(t(p.sprint ? "qzHeadSprint" : "qzHead", { m: p.minutes }))}`, "cheer");
  view().innerHTML = `<div class="ob qz qz-plan">${head(N + 1, true)}${s.html}
    <div class="ob-body"><ul class="qz-rows">${rows}</ul><p class="ob-note">${esc(note)}</p></div>
    <div class="ob-foot"><button class="ld-b ld-go" id="qzDrop" type="button">${UPLOAD}<span id="qzDropTxt">${esc(t("landDrop"))}</span></button>
      <input type="file" id="qzPick" accept="${ACCEPT}" multiple hidden>
      <p class="ld-types">${esc(t("landTypes"))}</p>
      ${viaMail ? "" : `<button class="ld-b ld-have qz-mail" id="qzMail" type="button">${MAIL}<span>${esc(t("qzMail"))}</span></button>
      <form class="qz-mform" id="qzMForm" hidden novalidate><input class="ob-in" id="qzMIn" type="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="200" placeholder="${esc(t("qzMailPh"))}" aria-label="${esc(t("qzMailPh"))}"><button class="ld-b ld-go" type="submit">${esc(t("qzMailGo"))}</button></form>
      <p class="qz-mok" id="qzMOk" hidden role="status"></p>`}
      <p class="ob-err c" id="err" hidden role="alert"></p></div></div>`;
  $("#qzBack").onclick = () => ctx.nav("#/q/" + N);
  const drop = $("#qzDrop"), pick = $("#qzPick");
  let busy = false;
  const idle = () => { busy = false; drop.classList.remove("busy"); drop.removeAttribute("aria-busy"); drop.querySelector("svg").outerHTML = UPLOAD; $("#qzDropTxt").textContent = t("landDrop"); };
  drop.onclick = () => { window.pcHit?.("/app/q/upload-tap"); pick.click(); };
  pick.oncancel = () => window.pcHit?.("/app/q/upload-cancel");
  pick.onchange = async e => {
    const files = [...e.target.files]; e.target.value = ""; if (!files.length || busy) return;
    busy = true; drop.classList.add("busy"); drop.setAttribute("aria-busy", "true"); drop.querySelector("svg").outerHTML = SPIN; $("#qzDropTxt").textContent = t("landBusy"); $("#err").hidden = true;
    try { await ctx.takeFiles(files); } catch (err) { idle(); ctx.fail($("#err"), err); }
  };
  // "My slides are on my computer": the plan link by email, to the address from the contact step or one typed here.
  const mail = $("#qzMail"); if (!mail) return;
  const form = $("#qzMForm"), ok = $("#qzMOk"), err = $("#err");
  let sending = false;
  const send = async email => {
    if (sending) return;
    sending = true; mail.disabled = true; err.hidden = true;
    try {
      await lead(email, true);
      window.pcHit?.("/app/q/mail-sent");
      mail.hidden = form.hidden = true;
      ok.textContent = t("qzMailOk", { email }); ok.hidden = false;
    } catch (e) {
      if (["bad_email", "too_many", "offline"].includes(e.code)) ctx.fail(err, e);
      else { err.textContent = t("qzMailFail"); err.hidden = false; }
    }
    sending = false; mail.disabled = false;
  };
  mail.onclick = () => {
    window.pcHit?.("/app/q/mail-tap");
    if (me?.kind === "email") return send(me.v);
    mail.hidden = true; form.hidden = false; $("#qzMIn").focus();
  };
  form.onsubmit = e => {
    e.preventDefault();
    const m = contactOf($("#qzMIn").value);
    if (m?.kind !== "email") return ctx.fail(err, { code: "bad_email" });
    send(m.v);
  };
}

// #/q, #/q/1 … #/q/5, #/q/contact, #/q/plan. A step ahead of the answers goes back to the first open question, and the
// plan without a contact goes to the contact step.
function quizRoute(parts, ctx) {
  const a = answers(), open = firstOpen(a);
  if (parts[0] === "contact") return open ? ctx.nav("#/q/" + open) : viewContact(ctx);
  if (parts[0] === "plan") return open ? ctx.nav("#/q/" + open) : contactKnown() ? viewPlan(ctx) : ctx.nav("#/q/contact");
  const step = Number(parts[0]);
  if (!Number.isInteger(step) || step < 1 || step > N) return ctx.nav("#/q/1");
  if (open && step > open) return ctx.nav("#/q/" + open);
  if (step === 1) lastBar = BAR[1];
  return viewQuestion(step, ctx);
}

export { setupBar, quizRoute, quizArrived, campaignFrom, planFrom, contactOf, phoneParts, phoneOf, quizPlan, firstOpen, QUESTIONS };

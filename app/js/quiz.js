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

// Icon colours: only from the Flat UI "American" palette (flatuicolors.com/palette/us), one strong colour per answer so
// the four cards of a question read apart at a glance. They are fixed, not theme variables: they hold on both themes.
const RED = "#FF7675", ORANGE = "#E17055", PEACH = "#FAB1A0", LEMON = "#FFEAA7", MINT = "#55EFC4", GREEN = "#00B894", TEAL = "#00CEC9",
  SKY = "#74B9FF", BLUE = "#0984E3", LILAC = "#A29BFE", PURPLE = "#6C5CE7", PINK = "#FD79A8", PAPER = "#DFE6E9", GREY = "#B2BEC3", INK = "#2D3436";
const svg = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const cal = (head, dots) => `<rect x="3" y="5" width="18" height="16" rx="3.5" fill="${PAPER}"/><path d="M3 10V8.5A3.5 3.5 0 0 1 6.500 5h11A3.500 3.500 0 0 1 21 8.500V10z" fill="${head}"/><path d="M8 3v3.500M16 3v3.500" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>${dots}`;
const dot = (x, y, c) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${c}"/>`;
const sheet = (x, y, c) => `<rect x="${x}" y="${y}" width="12" height="15" rx="2.2" fill="${c}" stroke="${INK}" stroke-opacity=".18" stroke-width="1"/>`;
const lines = (x, y, c) => `<path d="M${x} ${y}h6M${x} ${y + 3}h6M${x} ${y + 6}h4" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`;
const clock = (pie, c) => `<circle cx="12" cy="12" r="9.300" fill="${PAPER}"/>${pie}<circle cx="12" cy="12" r="9.300" fill="none" stroke="${c}" stroke-width="1.800"/><circle cx="12" cy="12" r="1.400" fill="${INK}"/>`;
const ICONS = {
  when_week: svg(`<path d="M12 2.500c.6 3.400 5.500 5.600 5.500 11a5.500 5.500 0 0 1-11 0c0-2 .9-3.400 2-4.400.3 1.600 1 2.400 1.800 2.600C10 8.600 10.600 5 12 2.500z" fill="${RED}"/><path d="M12 12.500c1.400 1.200 2.400 2.200 2.400 3.900a2.400 2.400 0 0 1-4.800 0c0-1.600 1.100-2.600 2.400-3.900z" fill="${LEMON}"/>`),
  when_weeks: svg(cal(TEAL, dot(8, 13.5, GREEN) + dot(12, 13.5, GREEN) + dot(16, 13.5, GREEN) + dot(8, 17.5, GREEN) + dot(12, 17.5, GREY) + dot(16, 17.5, GREY))),
  when_month: svg(cal(SKY, dot(8, 13.5, BLUE) + dot(12, 13.5, BLUE) + dot(16, 13.5, BLUE) + dot(8, 17.5, BLUE) + dot(12, 17.5, BLUE) + dot(16, 17.5, BLUE))),
  when_idk: svg(`<circle cx="12" cy="12" r="9.500" fill="${PINK}"/><path d="M9.200 9.600a2.900 2.900 0 1 1 4.300 2.500c-.9.500-1.500 1-1.500 2.100" fill="none" stroke="#fff" stroke-width="2.200" stroke-linecap="round"/><circle cx="12" cy="17.300" r="1.300" fill="#fff"/>`),
  size_s: svg(sheet(6, 4.5, PAPER) + lines(9, 9, GREEN)),
  size_m: svg(sheet(8.5, 3, SKY) + sheet(4, 6, PAPER) + lines(7, 10.5, BLUE)),
  size_l: svg(sheet(10.5, 2, RED) + sheet(7, 4, PEACH) + sheet(3.5, 6.5, PAPER) + lines(6.5, 11, ORANGE)),
  size_idk: svg(`<path d="M3 8.500A2.500 2.500 0 0 1 5.500 6h3.800l2 2.200h7.200A2.500 2.500 0 0 1 21 10.700v6.800A2.500 2.500 0 0 1 18.500 20h-13A2.500 2.500 0 0 1 3 17.500z" fill="${LILAC}"/><path d="M3 11.200h18v6.300A2.500 2.500 0 0 1 18.500 20h-13A2.500 2.500 0 0 1 3 17.500z" fill="${PURPLE}"/>`),
  how_reread: svg(`<path d="M19 8.500A7.500 7.500 0 0 0 5.300 9.700M5 15.500a7.500 7.500 0 0 0 13.700-1.200" fill="none" stroke="${TEAL}" stroke-width="2.400" stroke-linecap="round"/><path d="M19.800 4.500v4.500h-4.500M4.200 19.500V15h4.500" fill="none" stroke="${TEAL}" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/>`),
  how_notes: svg(`<path d="M4 20l1.200-4.800L15.700 4.700a2 2 0 0 1 2.800 0l.8.8a2 2 0 0 1 0 2.800L8.800 18.800z" fill="${ORANGE}"/><path d="M4 20l1.200-4.800 3.600 3.600z" fill="${PEACH}"/><path d="M14.300 6.100l3.600 3.600" stroke="#fff" stroke-width="1.6" opacity=".8"/>`),
  how_quiz: svg(`<rect x="3" y="5" width="18" height="14" rx="3.500" fill="${PAPER}"/><circle cx="12" cy="12" r="4.900" fill="${GREEN}"/><path d="M9.800 12.100l1.600 1.600 2.900-3.200" fill="none" stroke="#fff" stroke-width="1.900" stroke-linecap="round" stroke-linejoin="round"/>`),
  how_none: svg(`<circle cx="12" cy="12" r="9.500" fill="${SKY}"/><path d="M7.300 10.600h5l-5 5.800h5.400" fill="none" stroke="#fff" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.300 6.400h3l-3 3.400h3.200" fill="none" stroke="#fff" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round"/>`),
  time_15: svg(clock(`<path d="M12 12V2.700a9.300 9.300 0 0 1 9.300 9.300z" fill="${MINT}"/>`, GREEN)),
  time_30: svg(clock(`<path d="M12 2.700a9.300 9.300 0 0 1 0 18.600z" fill="${SKY}"/>`, BLUE)),
  time_60: svg(`<circle cx="12" cy="12" r="9.500" fill="${PINK}"/><path d="M12 7v5l3.300 2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
  time_var: svg(`<path d="M3 15c2.500-7 4.500-7 6 0s3.500 7 6 0 3.500-5 6-2" fill="none" stroke="${ORANGE}" stroke-width="2.400" stroke-linecap="round"/><circle cx="6" cy="6" r="1.800" fill="${TEAL}"/><circle cx="18" cy="19" r="1.800" fill="${PINK}"/>`),
  pain_forget: svg(`<path d="M4 4v16h16" fill="none" stroke="${GREY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.500 6.500c1.500 7 5 10 12 10.500" fill="none" stroke="${RED}" stroke-width="2.600" stroke-linecap="round"/>`),
  pain_late: svg(`<path d="M19.500 14.500A8 8 0 0 1 9.500 4.500a8 8 0 1 0 10 10z" fill="${LILAC}"/><path d="M16.500 3.500l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="${PINK}"/>`),
  pain_start: svg(`<path d="M12 21v-9" stroke="${GREY}" stroke-width="2.400" stroke-linecap="round"/><path d="M5 4.500h10l3 3-3 3H5z" fill="${SKY}"/><path d="M19 12h-9l-2.500 2.500L10 17h9z" fill="${PINK}"/>`),
  pain_much: svg(sheet(10.5, 2, ORANGE) + sheet(7, 4, PEACH) + sheet(3.5, 6.5, PAPER) + `<path d="M9.500 10.500v5M9.500 18.500v.1" stroke="${ORANGE}" stroke-width="2.200" stroke-linecap="round"/>`),
  load: svg(cal(PURPLE, dot(8, 13.5, PURPLE) + dot(12, 13.5, PURPLE) + dot(16, 13.5, GREEN) + dot(8, 17.5, GREEN))),
  fit: svg(clock(`<path d="M12 7v5l3 2" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`, SKY)),
};
// The plan's "you repeat every slide n×" line: three growing bars (its own picture, so it never doubles the "reread" answer's arrows)
ICONS.rep = svg(`<rect x="3.500" y="13" width="4.600" height="7.500" rx="1.600" fill="${MINT}"/><rect x="9.700" y="8.500" width="4.600" height="12" rx="1.600" fill="${TEAL}"/><rect x="15.900" y="3.500" width="4.600" height="17" rx="1.600" fill="${GREEN}"/>`);

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

let lastBar = 0; // the bar's width on the screen before, so it grows from there instead of jumping
function head(step, back) {
  const now = Math.round((step - 1) / N * 100);
  const h = `<div class="ob-hd"><button class="ob-bk" id="qzBack" aria-label="${t("back")}">${back ? BACK : CLOSE}</button><div class="ob-bar qz-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${now}"><i style="width:${lastBar}%"></i></div><span class="ob-bkpad"></span></div>`;
  requestAnimationFrame(() => { const i = $(".qz-bar i"); if (i) i.style.width = now + "%"; lastBar = now; });
  return h;
}
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
    setTimeout(() => ctx.nav(step < N ? "#/q/" + (step + 1) : contactKnown() ? "#/q/plan" : "#/q/contact"), 420);
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
  const s = say(`<small class="qz-kick">${esc(t("qzKick"))}</small>${esc(t("qzCTitle"))}`, "talk");
  const legal = esc(t("qzCLegal")).replace("%", `<a href="#/privacy">${esc(t("qzCLegalLink"))}</a>`);
  view().innerHTML = `<div class="ob qz qz-contact">${head(N + .5, true)}${s.html}
    <p class="ob-sub">${esc(t("qzCSub"))}</p>
    <form class="ob-body" id="qzCForm" novalidate>
      <input class="ob-in" id="qzCIn" type="text" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="200" placeholder="${esc(t("qzCPh"))}" aria-label="${esc(t("qzCPh"))}" aria-describedby="err" value="${esc(quiz().contact?.v || "")}">
      <p class="ob-err c" id="err" hidden role="alert"></p>
    </form>
    <div class="ob-foot"><button class="ld-b ld-go" id="qzCGo" type="submit" form="qzCForm">${esc(t("qzCGo"))}</button>
      <p class="ob-legal qz-legal">${legal}</p></div></div>`;
  const talk = setTimeout(() => s.p.setState("idle"), 1100);
  $("#qzBack").onclick = () => ctx.nav("#/q/" + N);
  const box = $("#qzCIn"), go = $("#qzCGo"), err = $("#err");
  const bad = () => { err.textContent = t("qzCBad"); err.hidden = false; box.setAttribute("aria-invalid", "true"); box.focus(); };
  box.oninput = () => { err.hidden = true; box.removeAttribute("aria-invalid"); };
  let busy = false;
  $("#qzCForm").onsubmit = async e => {
    e.preventDefault(); if (busy) return;
    const c = contactOf(box.value); if (!c) return bad();
    busy = true; clearTimeout(talk); go.classList.add("busy"); go.setAttribute("aria-busy", "true");
    let sent = false;
    try { await Promise.race([lead(c.v, false), new Promise((_, no) => setTimeout(() => no(new Error("slow")), 4000))]); sent = true; }
    catch (e2) { if (e2.code === "bad_contact") { busy = false; go.classList.remove("busy"); go.removeAttribute("aria-busy"); return bad(); } }
    store.set("quiz", { ...quiz(), contact: { ...c, sent } });
    window.pcHit?.("/app/q/contact-" + c.kind);
    sfx.flip(); s.p.setState("correct");
    ctx.nav("#/q/plan");
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
  if (step === 1) lastBar = 0;
  return viewQuestion(step, ctx);
}

export { quizRoute, quizArrived, campaignFrom, planFrom, contactOf, quizPlan, firstOpen, QUESTIONS };

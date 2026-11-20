// Admin page (kvizoo.com/app/admin.html). The key stays in memory only, so a reload asks again.
// Stats tab (2026-11-18, redesigned 2026-11-19): four headline numbers against the period before (each one picks what the big chart
//   shows), what's true right now, where accounts are now, visit to sale, sources, pages, devices, Stripe payments.
//   Visits come from web/hit.js (no cookies); sales are paid Stripe invoices, so test clicks and refunds are not in them.
// Users tab (2026-11-19): one row per account: name, phone, email, the step it reached (generating → generated → level 1 started →
//   level 1 done → more levels), levels done, slides, API cost. pc-api admin users (supabase/functions/pc-api/users.js).
// Orders & courses tab: orders, courses, students, voice minutes, code reset.
import { esc, api, store } from "./util.js";

const root = document.getElementById("kz");
let key = null, data = null, stats = null, users = null, usersErr = "", note = "", busy = false;
const pref = (k, ok, dflt) => { try { const v = localStorage.getItem("pc.admin." + k); return v != null && ok(v) ? v : dflt; } catch { return dflt; } };
const keep = (k, v) => { try { localStorage.setItem("pc.admin." + k, String(v)); } catch { /* fine */ } };
let tab = pref("tab", v => ["stats", "users", "orders"].includes(v), "stats");
let days = +pref("days", v => [1, 7, 30, 90].includes(+v), 30);
let metric = pref("metric", v => ["visitors", "signups", "uploads", "sales"].includes(v), "visitors");
let stepFilter = "all", query = "", sort = { k: "created_at", dir: -1 }, open = new Set();
const call = (name, body = {}) => api("admin_" + name, { adminKey: key, ...body });
const when = v => v ? new Date(v).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" }) : "–";
const mins = s => `${Math.round((s || 0) / 60)}`;
const total = c => ["flashcard", "mc", "tf", "fill", "match"].reduce((n, k) => n + (c?.[k] || 0), 0);
const num = v => new Intl.NumberFormat("en-GB").format(v ?? 0);
const usd = v => v == null ? "–" : "$" + (v < 10 ? v.toFixed(2) : num(Math.round(v)));
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dayLabel = d => DAY.format(new Date(d + "T12:00:00Z"));
const pragueDay = v => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date(v));
const money = m => Object.entries(m || {}).filter(([, v]) => v).map(([c, v]) =>
  new Intl.NumberFormat(c === "czk" ? "cs-CZ" : "en-US", { style: "currency", currency: c.toUpperCase(), maximumFractionDigits: c === "czk" ? 0 : 2 }).format(v)).join(" + ") || "0 Kč";
// "3 h ago", "yesterday", "5 days ago"; the exact time sits in the title.
const ago = v => {
  if (!v) return "–";
  const m = Math.round((Date.now() - Date.parse(v)) / 60000);
  return m < 2 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : m < 2880 ? "yesterday" : m < 60 * 24 * 45 ? `${Math.round(m / 1440)} days ago` : when(v).split(" ")[0];
};
const agoCell = v => `<span title="${esc(when(v))}">${ago(v)}</span>`;
const notrack = () => { try { return !!localStorage.getItem("pc.notrack"); } catch { return false; } };
const setNotrack = on => { try { on ? localStorage.setItem("pc.notrack", "1") : localStorage.removeItem("pc.notrack"); } catch { /* blocked */ } };

function login(err = "") {
  root.innerHTML = `<div class="kz-gate"><div><h1>Kvizoo <span>admin</span></h1><form class="kz-login" id="f">
    <input type="text" name="username" autocomplete="username" value="kvizoo-admin" hidden>
    <input class="ob-in" id="k" name="password" type="password" inputmode="numeric" autocomplete="current-password" placeholder="Admin key" aria-label="Admin key">
    <button class="btn-p">Open</button><p class="kz-err" role="alert">${esc(err)}</p></form></div></div>`;
  document.getElementById("f").onsubmit = async e => {
    e.preventDefault();
    key = document.getElementById("k").value.trim();
    // One call checks the key; only then the others, so a wrong key costs one try, not three.
    try { await loadStats(); setNotrack(true); } // this browser is Marek's: its visits stop counting (the box on the page undoes it)
    catch (er) { key = null; return login(er.code === "too_many" ? "Too many wrong keys. Wait 10 minutes, or up to a day if many were tried from everywhere (your phone got an alert)." : er.code === "bad_admin" ? "That key doesn't work." : `Something broke: ${er.code || er.message}`); }
    await loadUsers();
    if (tab === "orders") await loadOrders();
    paint();
  };
}
async function loadStats() { stats = await call("stats", { days }); }
// The Users tab needs pc-api with admin users; until it's deployed the rest of the page still works.
async function loadUsers() {
  try { users = await call("users"); usersErr = ""; }
  catch (e) { users = null; usersErr = e.code === "no_action" ? "The Users tab needs the new pc-api (admin users), which isn't deployed yet." : `Users didn't load: ${e.code || e.message}`; }
}
async function loadOrders() { try { data = await call("overview"); } catch (e) { note = `<span class="kz-err">Failed: ${esc(e.code || e.message)}</span>`; } }

// ---------- frame: title and tabs ----------
function paint() {
  const tabBtn = (id, label, n) => `<button data-tab="${id}" aria-pressed="${tab === id}">${label}${n != null ? `<span class="kz-cnt">${num(n)}</span>` : ""}</button>`;
  root.innerHTML = `<div class="kz-top"><h1>Kvizoo <span>admin</span></h1><div class="kz-tabs" role="group" aria-label="Sections">${tabBtn("stats", "Stats")}${tabBtn("users", "Users", users?.users.length)}${tabBtn("orders", "Orders &amp; courses")}</div></div>
  ${note ? `<div class="kz-note">${note}</div>` : ""}<div id="body"></div>`;
  note = "";
  root.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => go(b.dataset.tab));
  const body = root.querySelector("#body");
  if (tab === "stats") paintStats(body); else if (tab === "users") paintUsers(body); else paintOrders(body);
}
async function go(t) {
  if (busy) return;
  tab = t; keep("tab", t);
  if (t === "orders" && !data) { busy = true; root.querySelector("#body").innerHTML = `<p class="kz-muted">Loading…</p>`; await loadOrders(); busy = false; }
  paint();
}
async function period(d) {
  if (busy) return;
  busy = true; days = d; keep("days", d);
  root.querySelectorAll("[data-days]").forEach(b => { b.disabled = true; b.setAttribute("aria-pressed", String(+b.dataset.days === d)); });
  try { await Promise.all([loadStats(), loadUsers()]); } catch (e) { note = `<span class="kz-err">Failed: ${esc(e.code || e.message)}</span>`; }
  busy = false; paint();
}

// ---------- charts ----------
// Nice round gridlines: up to 4 steps of 1, 2 or 5 × 10^k, whole numbers only.
function scale(max) {
  if (!(max > 0)) return { top: 4, step: 1 };
  const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw)), step = Math.max(1, [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw));
  return { top: Math.ceil(max / step) * step, step };
}
// One series, bars per day, one y axis, hover or tap for the day's numbers. rows: [{ label, v, tip, off }]; off = not counted yet.
const charts = {};
let chartId = 0, hiders = [];
function barChart(rows, { h = 220 } = {}) {
  const id = "c" + ++chartId, { top, step } = scale(Math.max(0, ...rows.map(r => r.v)));
  const grid = [];
  for (let t = 0; t <= top; t += step) grid.push(t);
  const n = rows.length, every = n <= 10 ? 1 : Math.ceil(n / 7);
  const xs = rows.map((r, i) => (n - 1 - i) % every === 0 ? `<span style="left:${(i + .5) / n * 100}%"${(n - 1 - i) / every % 2 ? " class=\"alt\"" : ""}>${esc(r.label)}</span>` : "").join("");
  charts[id] = rows;
  return `<div class="kz-ch" style="--h:${h}px">
      <div class="kz-y" aria-hidden="true">${grid.map(t => `<span style="bottom:${t / top * 100}%">${num(t)}</span>`).join("")}</div>
      <div class="kz-plot" data-chart="${id}" role="img" aria-label="${rows.map(r => `${r.label} ${r.off ? "not counted" : r.v}`).join(", ")}">
        ${grid.slice(1).map(t => `<div class="kz-gl" style="bottom:${t / top * 100}%"></div>`).join("")}
        <div class="kz-cols"${n > 45 ? ' style="gap:1px"' : ""}>${rows.map(r => `<div class="kz-col${r.off ? " off" : ""}"><i style="height:${r.off ? 0 : r.v / top * 100}%"${r.v && !r.off ? "" : ' class="z"'}></i></div>`).join("")}</div>
        <div class="kz-tip" hidden></div>
      </div>
      <div class="kz-x" aria-hidden="true">${xs}</div>
    </div>`;
}
function wireCharts(el) {
  hiders = [];
  el.querySelectorAll("[data-chart]").forEach(plot => {
    const rows = charts[plot.dataset.chart], tip = plot.querySelector(".kz-tip"), cols = plot.querySelectorAll(".kz-col");
    let on = -1;
    const show = e => {
      const r = plot.getBoundingClientRect(), i = Math.max(0, Math.min(rows.length - 1, Math.floor((e.clientX - r.left) / r.width * rows.length)));
      if (i !== on) { cols[on]?.classList.remove("on"); cols[i].classList.add("on"); on = i; tip.innerHTML = rows[i].tip; }
      tip.hidden = false;
      const x = (i + .5) / rows.length * r.width, w = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(r.width - w, x - w / 2)) + "px";
    };
    const hide = () => { tip.hidden = true; cols[on]?.classList.remove("on"); on = -1; };
    plot.addEventListener("pointermove", show);
    plot.addEventListener("pointerdown", show);
    // A finger lifting fires pointerleave at once, so on touch the numbers stay until a tap somewhere else.
    plot.addEventListener("pointerleave", e => { if (e.pointerType !== "touch") hide(); });
    hiders.push([plot, hide]);
  });
}
document.addEventListener("pointerdown", e => { for (const [plot, hide] of hiders) if (!plot.contains(e.target)) hide(); });
// A small area line under a headline number: the shape of the period, no axes.
function spark(vals) {
  if (vals.length < 2) return "";
  const max = Math.max(1, ...vals), n = vals.length - 1, pts = vals.map((v, i) => `${(i / n * 100).toFixed(2)},${(28 - v / max * 26).toFixed(2)}`);
  return `<svg viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path class="a" d="M0,28 L${pts.join(" L")} L100,28 Z"/><path class="l" d="M${pts.join(" L")}"/></svg>`;
}
// Horizontal bars for a few named rows: label, bar against the largest, number, and a share when asked.
const hbars = (rows, { pctOf = null } = {}) => {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return `<div class="kz-h">${rows.map(([label, v, sub]) => `<div class="hl">${label}${sub ? `<br><span class="kz-muted">${sub}</span>` : ""}</div>
    <div class="hb"><i style="width:${v / max * 100}%"${v ? "" : ' class="z"'}></i></div><div class="hn">${num(v)}${pctOf ? ` <span class="kz-muted">${Math.round(v / pctOf * 100)}%</span>` : ""}</div>`).join("")}</div>`;
};
// A table of counts with a thin share bar in the first number column; past `cap` rows the rest fold away.
function countTable(head, rows, { share = 1, cap = 0 } = {}) {
  const max = Math.max(1, ...rows.map(r => +r[share] || 0));
  const tr = r => `<tr>${r.map((c, i) => `<td${i ? ' class="kz-n"' : ""}>${i ? num(c) : c}</td>`).join("")}${share ? `<td class="kz-sh">${+r[share] ? `<i style="width:${r[share] / max * 100}%"></i>` : ""}</td>` : ""}</tr>`;
  const headRow = `<tr>${head.map((h, i) => `<th${i ? ' class="kz-n"' : ""}>${h}</th>`).join("")}${share ? "<th></th>" : ""}</tr>`;
  if (!rows.length) return `<div class="kz-scroll"><table>${headRow}<tr><td colspan="${head.length + 1}" class="kz-muted">Nothing yet in this period.</td></tr></table></div>`;
  const shown = cap && rows.length > cap + 2 ? rows.slice(0, cap) : rows, rest = rows.slice(shown.length);
  return `<div class="kz-scroll"><table>${headRow}${shown.map(tr).join("")}</table></div>
    ${rest.length ? `<details class="kz-more"><summary>Show ${rest.length} more</summary><div class="kz-scroll"><table>${rest.map(tr).join("")}</table></div></details>` : ""}`;
}
const card = (title, inner, { aside = "", foot = "", flush = false } = {}) =>
  `<div class="kz-card${flush ? " flush" : ""}"><h3>${title}${aside ? `<small>${aside}</small>` : ""}</h3>${inner}${foot ? `<p class="kz-foot">${foot}</p>` : ""}</div>`;

// ---------- Stats tab ----------
const SOURCE_NOTE = { direct: "typed in, a bookmark, or an app that hides it", unknown: "before visit counting, or no visit that day" };
const srcLabel = s => `<b>${esc(s)}</b>${SOURCE_NOTE[s] ? `<span class="sub">${SOURCE_NOTE[s]}</span>` : ""}`;
const PAGE_NAMES = {
  "/": "Landing (kvizoo.com)", "/en/": "English share card", "/app/": "App: welcome", "/app/new": "Setup", "/app/new/files": "Setup 1: slides", "/app/new/date": "Setup 2: exam date",
  "/app/new/tutor": "Setup 3: tutor", "/app/new/source": "Setup 4: where from", "/app/new/notify": "Setup 5: reminders", "/app/new/account": "Setup 6: account",
  "/app/s": "Course home", "/app/s/lesson": "Lesson", "/app/s/practice": "Practice", "/app/s/review": "Review", "/app/s/test": "Test", "/app/s/notes": "Notes",
  "/app/s/progress": "Progress", "/app/s/settings": "Course settings", "/app/unlock": "Plans and prices", "/app/paid": "After paying", "/app/wait": "Course being made",
  "/app/login": "Sign in", "/app/t": "Tester link", "/priprava-na-zkousky/": "Exam prep: all schools",
  "/app/upload-tap": "Tapped \"Upload slides\"", "/app/upload-cancel": "Closed the picker with no file",
};
const pageLabel = p => `${esc(PAGE_NAMES[p] || (p.startsWith("/priprava-na-zkousky/") ? "Exam prep: " + p.split("/")[2].toUpperCase() : p))}<span class="sub">${esc(p)}</span>`;
const KIND = { new: "new subscription", renewal: "renewal", change: "plan change", other: "other" };
const vsText = () => days === 1 ? "vs yesterday by this time" : `vs the ${days} days before`;
// The change against the period before, as a small pill. prev null = nothing to compare with (not counted then).
function delta(cur, prev) {
  if (prev == null || cur == null) return `<span class="kz-d na" title="Not counted in the period before">no earlier data</span>`;
  if (cur === prev) return `<span class="kz-d same" title="${vsText()}">same</span>`;
  const up = cur > prev, d = Math.abs(cur - prev), pct = prev ? ` · ${Math.round(d / prev * 100)}%` : "";
  return `<span class="kz-d ${up ? "up" : "down"}" title="${vsText()}: ${num(prev)}">${up ? "▲" : "▼"} ${num(d)}${pct}</span>`;
}

function paintStats(el) {
  if (!stats) { el.innerHTML = `<p class="kz-muted">Loading…</p>`; return; }
  for (const k in charts) delete charts[k];
  const s = stats, T = s.totals || {}, P = s.prev || {}, pay = s.pay || {}, now = s.now || {};
  const pd = (label, d) => `<button data-days="${d}" aria-pressed="${days === d}">${label}</button>`;
  const since = now.trackingSince ? pragueDay(now.trackingSince) : null;
  const byDay = pay.byDay || {};
  const daily = (s.daily || []).map(d => ({ ...d, sales: byDay[d.day]?.n || 0, fresh: byDay[d.day]?.fresh || 0 }));
  // Visits only count from the day tracking started: earlier days are hatched, and the visitor numbers have nothing to compare with.
  const fullVisits = !!since && since <= (daily[0]?.day || since);
  const prevVisits = !!since && s.prevFrom && since <= pragueDay(s.prevFrom);
  const today = pragueDay(Date.now());
  const lbl = d => dayLabel(d.day) + (d.day === today ? " (today so far)" : "");
  const off = d => (!since || d.day < since);
  const tipFor = d => `<b>${lbl(d)}</b><br>${off(d) ? "visits not counted yet" : `${num(d.visitors)} visitors · ${num(d.views)} page views`}<br>${num(d.signups)} new accounts · ${num(d.uploads)} uploads · ${num(d.sales)} sales`;
  const paying = now.paying || [], payingN = paying.reduce((a, p) => a + p.n, 0);
  const payingBy = paying.map(p => `${p.n} ${p.plan === "pro" ? "Pro" : "Max"} (${p.currency.toUpperCase()})`).join(", ");
  const sl = s.slides || {}, B = sl.buckets || [0, 0, 0, 0, 0];
  const dict = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]);
  const devWords = { mobile: "Phone", tablet: "Tablet", desktop: "Computer", "?": "Unknown" };
  const noPay = !!pay.error;
  const hasCountry = Object.keys(s.countries || {}).some(k => k !== "?");

  const KPI = {
    visitors: { label: "Visitors", v: num(T.visitors), d: delta(T.visitors, prevVisits ? P.visitors : null), sub: `${num(T.views)} page views · ${num(T.visits)} from outside`, of: d => off(d) ? 0 : d.visitors, title: "Visitors per day", foot: "A visitor is one browser on one address on one day; the same person tomorrow counts again." },
    signups: { label: "New accounts", v: num(T.signups), d: delta(T.signups, P.signups), sub: fullVisits && T.visitors ? `${Math.round(T.signups / T.visitors * 100)}% of visitors` : `${num(now.accounts)} accounts in all`, of: d => d.signups, title: "New accounts per day" },
    uploads: { label: "Uploads", v: num(T.uploaded), d: delta(T.uploaded, P.uploaded), sub: `${num(T.slides)} slides · ${num(T.started)} setups started`, of: d => d.uploads, title: "Uploads per day" },
    sales: noPay ? { label: "Revenue", v: "?", d: "", sub: esc(pay.error), of: d => d.sales, title: "Sales per day", foot: esc(pay.error) }
      : { label: "Revenue", v: money(pay.cur.money), d: delta(pay.cur.n, pay.prev.n), sub: `${num(pay.cur.n)} payments · ${num(pay.cur.fresh)} new · before ${money(pay.prev.money)}`, of: d => d.sales, title: "Sales per day", foot: "Paid invoices in Stripe; refunds are not taken off." },
  };
  const M = KPI[metric];
  const rows = daily.map(d => ({ label: dayLabel(d.day), v: M.of(d), off: metric === "visitors" && off(d), tip: tipFor(d) }));
  const sum = rows.reduce((a, r) => a + r.v, 0);

  // Where accounts are now (the Users tab's steps), when pc-api has them.
  const U = users;
  const flowCard = U ? card(`Where the ${num(U.users.length)} accounts are now`, hbars(FLOW.map(k => [stagePill(k), U.stages[k] || 0]).concat(U.stages.failed ? [[stagePill("failed"), U.stages.failed]] : []), { pctOf: U.users.length || null }),
    { foot: `Each account counts once, at the furthest step any of its courses reached. ${U.noAccount.orders ? `<b>${num(U.noAccount.orders)}</b> more uploads never made an account.` : ""} <a href="#" data-goto="users">Open Users</a>` })
    : card("Where accounts are now", `<p class="kz-muted">${esc(usersErr || "Loading…")}</p>`);
  const funnel = [...(fullVisits ? [["Visitors", T.visitors || 0]] : []), ["Began setup", T.started || 0], ["Uploaded slides", T.uploaded || 0], ["Made an account", T.signups || 0], ["Bought a plan", noPay ? 0 : pay.cur.fresh]];

  el.innerHTML = `
  <div class="kz-bar"><div class="kz-seg" role="group" aria-label="Period">${pd("Today", 1)}${pd("7 days", 7)}${pd("30 days", 30)}${pd("90 days", 90)}<button data-refresh title="Load again">Refresh</button></div>
    <span class="kz-muted">Changes are ${vsText()}</span>
    <label class="kz-check"><input type="checkbox" id="nt"${notrack() ? " checked" : ""}> Don't count my visits from this browser</label></div>
  ${!since ? `<p class="kz-note">Visit counting starts with the first visitor after this update. Accounts, sales and slides below already go back further.</p>` : ""}
  <div class="kz-kpis" role="group" aria-label="Headline numbers: pick one for the chart">
    ${Object.entries(KPI).map(([id, k]) => `<button class="kz-card kz-kpi" data-metric="${id}" aria-pressed="${metric === id}">
      <span class="l">${k.label}</span><span class="v">${k.v}</span><span>${k.d}</span><span class="s">${k.sub}</span>${spark(daily.filter(d => !(id === "visitors" && off(d))).map(k.of))}</button>`).join("")}
  </div>
  <div class="kz-now">
    <div><b>${num(payingN)}</b>paying now${payingBy ? ` · ${esc(payingBy)}` : ""}</div><div><b>${money(s.mrr)}</b>a month from them</div>
    <div><b>${num(now.accounts)}</b>accounts in all</div><div><b>${num(now.testers)}</b>testers on a free plan</div><div><b>${num(now.studying7)}</b>courses studied, last 7 days</div>
  </div>
  ${card(M.title, barChart(rows), { aside: `<span class="kz-total">${num(sum)}</span> in ${days === 1 ? "today" : `${days} days`}`,
    foot: [M.foot, metric === "visitors" && since && !fullVisits ? `Visits are counted from ${dayLabel(since)}; striped days before that have no visit data.` : ""].filter(Boolean).join(" ") })}

  <div class="kz-grid c2">
    ${flowCard}
    ${card("From visit to sale", hbars(funnel, { pctOf: funnel[0][1] || null }),
      { aside: "this period", foot: `Each step is counted over the same period, not the same people followed one by one. % is of the first step.${!fullVisits && since ? ` Visitors are left out: they're only counted from ${dayLabel(since)}.` : ""}` })}
  </div>
  <div class="kz-grid w21">
    ${card("Where visitors came from", countTable(["Source", "Visits", "Visitors", "Accounts", "Paying"], (s.sources || []).map(r => [srcLabel(r.source), r.visits, r.visitors, r.signups, r.paying])),
      { flush: true, foot: `Tag your links so they show up by name: <code>kvizoo.com/?utm_source=tiktok&amp;utm_campaign=bio</code> (or short: <code>?ref=tt</code>). Accounts are matched to the visit from the same browser that day. From 20 Nov, Facebook's own link checks and other scanners aren't counted; before that, a Facebook post showed up as several visits within seconds of posting.` })}
    ${card("Slides per upload", hbars([["Up to 20", B[0]], ["21 to 50", B[1]], ["51 to 100", B[2]], ["101 to 250", B[3]], ["Over 250", B[4]]]),
      { foot: `${num(sl.uploads)} uploads · ${num(sl.files)} files · ${num(sl.total)} slides · average ${num(sl.avg)} · median ${num(sl.median)} · largest ${num(sl.max)}` })}
  </div>
  <div class="kz-grid c2">
    ${card("What they said at sign-up", countTable(["Answer", "Accounts"], dict(s.said).map(([k, v]) => [esc(k), v])), { flush: true })}
    ${card("Tagged links", countTable(["Campaign", "Visits"], (s.campaigns || []).map(c => [`<b>${esc(c.campaign)}</b><span class="sub">${esc(c.source)}</span>`, c.visits])), { flush: true })}
  </div>
  <div class="kz-grid">${card("Pages", countTable(["Page", "Views", "Visitors", "Landed here"], (s.pages || []).map(p => [pageLabel(p.path), p.views, p.visitors, p.entries]), { cap: 8 }), { flush: true })}</div>
  <div class="kz-grid ${hasCountry ? "c3" : "c2"}">
    ${card("Devices", hbars(dict(s.devices).map(([k, v]) => [devWords[k] || esc(k), v]), { pctOf: T.visitors || null }))}
    ${card("Browser languages", hbars(dict(s.langs).slice(0, 6).map(([k, v]) => [esc(k === "?" ? "unknown" : k), v]), { pctOf: T.visitors || null }))}
    ${hasCountry // Supabase's edge sends no country header today, so this stays hidden until it does
    ? card("Countries", hbars(dict(s.countries).slice(0, 6).map(([k, v]) => [esc(k === "?" ? "unknown" : k), v]), { pctOf: T.visitors || null })) : ""}
  </div>
  <div class="kz-grid">${card("Payments in Stripe", noPay ? `<p class="kz-err" style="padding:0 20px 16px">${esc(pay.error)}</p>` : `<div class="kz-scroll"><table><tr><th>Paid</th><th class="kz-n">Amount</th><th>Plan</th><th>What</th><th>Email</th></tr>
    ${(pay.list || []).length ? pay.list.map(p => `<tr><td>${when(p.at)}</td><td class="kz-n">${money({ [p.currency]: p.amount })}</td><td>${esc(p.plan || "–")}</td><td>${KIND[p.kind] || esc(p.kind)}</td><td>${esc(p.email || "–")}</td></tr>`).join("")
    : `<tr><td colspan="5" class="kz-muted">No payments in this period.</td></tr>`}</table></div>`, { flush: true })}</div>
  <p class="kz-foot">Updated ${when(s.to)} · period from ${when(s.from)}</p>`;

  el.querySelectorAll("[data-days]").forEach(b => b.onclick = () => period(+b.dataset.days));
  el.querySelector("[data-refresh]").onclick = () => period(days);
  el.querySelector("#nt").onchange = e => setNotrack(e.target.checked);
  el.querySelectorAll("[data-metric]").forEach(b => b.onclick = () => { metric = b.dataset.metric; keep("metric", metric); paintStats(el); });
  el.querySelectorAll("[data-goto]").forEach(a => a.onclick = e => { e.preventDefault(); go(a.dataset.goto); });
  wireCharts(el);
}

// ---------- Users tab ----------
// Steps from supabase/functions/pc-api/users.js. FLOW is the way through a course, in order; failed and signed_up sit outside it.
const FLOW = ["generating", "generated", "l1_started", "l1_done", "levels"];
const STAGE = {
  signed_up: { label: "Signed up", tone: "mute", hint: "account made, no course queued" },
  failed: { label: "Build failed", tone: "bad", hint: "the course couldn't be built" },
  generating: { label: "Generating course", tone: "info", hint: "queued or building, nothing out yet" },
  generated: { label: "Course generated", tone: "acc", hint: "lessons are out, nothing studied" },
  l1_started: { label: "Level 1 started", tone: "gold", hint: "answered or read something" },
  l1_done: { label: "Level 1 completed", tone: "good", hint: "played a level to its end" },
  levels: { label: "2+ levels completed", tone: "good2", hint: "two or more levels in one course" },
};
const stagePill = k => `<span class="kz-pill t-${STAGE[k]?.tone || "mute"}">${STAGE[k]?.label || esc(k)}</span>`;
const dots = k => { const at = FLOW.indexOf(k); return `<span class="kz-dots t-${STAGE[k]?.tone || "mute"}" aria-hidden="true">${FLOW.map((_, i) => `<i${i <= at ? ' class="on"' : ""}></i>`).join("")}</span>`; };
const ORDER_STATUS = { free_queued: "free lessons queued", building: "building", free_ready: "free lessons ready", paid_test: "paid, rest queued", ready: "full course ready", failed: "failed" };
const SORTS = {
  name: u => (u.name || "").toLowerCase(), stage: u => Object.keys(STAGE).indexOf(u.stage), levels: u => u.levels, slides: u => u.slides,
  cost: u => u.cost ?? -1, created_at: u => u.created_at || "", lastActive: u => u.lastActive || "",
};

function paintUsers(el) {
  if (!users) { el.innerHTML = `<p class="${usersErr ? "kz-err" : "kz-muted"}" style="margin-top:20px">${esc(usersErr || "Loading…")}</p>`; return; }
  const U = users, all = U.users.length;
  const reached = k => U.users.filter(u => FLOW.indexOf(u.stage) >= FLOW.indexOf(k)).length;
  const costs = U.users.filter(u => u.cost != null), costSum = costs.reduce((a, u) => a + u.cost, 0);
  const step = k => `<button class="kz-step t-${STAGE[k].tone}" data-step="${k}" aria-pressed="${stepFilter === k}" title="${STAGE[k].hint}">
    <span class="k"><i></i>${STAGE[k].label}</span><span class="v">${num(U.stages[k] || 0)}</span>
    <span class="r">${k === "generating" ? "now" : `${num(reached(k))} reached it · ${all ? Math.round(reached(k) / all * 100) : 0}%`}</span>
    <span class="m"><i style="width:${all ? reached(k) / all * 100 : 0}%"></i></span></button>`;
  const chip = (k, label) => `<button class="kz-chip" data-step="${k}" aria-pressed="${stepFilter === k}">${label}</button>`;
  const leak = U.noAccount;
  el.innerHTML = `
  <div class="kz-bar"><div><h2 style="margin:8px 0 2px">${num(all)} accounts</h2><span class="kz-muted">Each sits at the furthest step any of its courses reached. Tap a step to list who is there.</span></div>
    <button class="kz-btn" data-reload>Refresh</button></div>
  <div class="kz-steps" role="group" aria-label="Steps">${FLOW.map(step).join("")}</div>
  ${leak.orders ? `<div class="kz-callout"><span>⚠</span><span><b>${num(leak.orders)} uploads never became an account</b>: they left at the sign-up step${leak.generated ? `, and ${num(leak.generated)} of them had their free lessons built anyway` : ""}. ${num(leak.slides)} slides${leak.cost != null ? `, ${usd(leak.cost)} API cost recorded` : ""}. Some may be your own tests.</span></div>` : ""}
  <div class="kz-chips">${chip("all", `All ${num(all)}`)}${U.stages.failed ? chip("failed", `Build failed ${num(U.stages.failed)}`) : ""}${U.stages.signed_up ? chip("signed_up", `Nothing queued ${num(U.stages.signed_up)}`) : ""}
    <input class="kz-search" id="uq" type="search" placeholder="Search name, email or phone" aria-label="Search accounts" value="${esc(query)}"></div>
  <div class="kz-card flush" style="margin-top:12px"><div class="kz-scroll" id="ut"></div>
    <p class="kz-foot" style="padding-top:12px">${U.costRecorded
      ? `API cost = what building their courses cost on Anthropic (lessons, quality pass, photo reads). ${costs.length ? `${usd(costSum)} recorded across ${num(costs.length)} accounts. ` : ""}Builds before cost recording started show –; a * means some of that account's builds weren't recorded.`
      : `API cost isn't recorded yet: it needs migration 017 and the new builder (each build then adds its dollars to its order, the same number as runs.jsonl). Until then every cost shows –, never a guess.`}
      Levels = levels finished, all courses together. Click a row for each course.</p></div>`;
  el.querySelectorAll("[data-step]").forEach(b => b.onclick = () => { stepFilter = stepFilter === b.dataset.step ? "all" : b.dataset.step; paintUsers(el); });
  el.querySelector("[data-reload]").onclick = async () => { await loadUsers(); paint(); };
  const q = el.querySelector("#uq");
  q.oninput = () => { query = q.value; usersTable(el.querySelector("#ut")); };
  usersTable(el.querySelector("#ut"));
}

function usersTable(box) {
  const q = query.trim().toLowerCase(), qd = q.replace(/\D/g, "");
  const list = users.users
    .filter(u => stepFilter === "all" || u.stage === stepFilter)
    .filter(u => !q || [u.name, u.email].some(v => (v || "").toLowerCase().includes(q)) || (qd.length >= 3 && (u.phone || "").replace(/\D/g, "").includes(qd)))
    .sort((a, b) => { const x = SORTS[sort.k](a), y = SORTS[sort.k](b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  const th = (k, label, cls = "") => `<th${cls ? ` class="${cls}"` : ""}><button data-sort="${k}"${sort.k === k ? ` aria-sort="${sort.dir > 0 ? "ascending" : "descending"}"` : ""}>${label}</button></th>`;
  const row = u => {
    const isOpen = open.has(u.id);
    return `<tr class="u" data-u="${esc(u.id)}" aria-expanded="${isOpen}" tabindex="0">
      <td><b>${esc(u.name || "–")}</b>${u.plan ? ` <span class="kz-pill t-acc" style="padding:1px 8px">${u.plan === "pro" ? "Pro" : "Max"}</span>` : ""}<span class="sub">${esc(u.email || "no email")}</span></td>
      <td class="nw">${esc(u.phone || "–")}</td>
      <td class="st">${stagePill(u.stage)}${dots(u.stage)}</td>
      <td class="kz-n" data-l="Levels">${num(u.levels)}</td><td class="kz-n" data-l="Slides">${num(u.slides)}</td>
      <td class="kz-n" data-l="API cost" title="${u.cost == null ? "not recorded" : u.costPartial ? "some builds not recorded" : "recorded"}">${usd(u.cost)}${u.costPartial ? "*" : ""}</td>
      <td class="nw" data-l="Joined">${agoCell(u.created_at)}</td><td class="nw" data-l="Active">${agoCell(u.lastActive)}</td></tr>
      ${isOpen ? `<tr class="x"><td colspan="8">${details(u)}</td></tr>` : ""}`;
  };
  box.innerHTML = `<table class="kz-users"><thead><tr>${th("name", "Name and email")}<th>Phone</th>${th("stage", "Step")}${th("levels", "Levels", "kz-n")}${th("slides", "Slides", "kz-n")}${th("cost", "API cost", "kz-n")}${th("created_at", "Joined")}${th("lastActive", "Last active")}</tr></thead>
    <tbody>${list.length ? list.map(row).join("") : `<tr><td colspan="8" class="kz-muted">Nobody here${q ? " for that search" : ""}.</td></tr>`}</tbody></table>`;
  box.querySelectorAll("[data-sort]").forEach(b => b.onclick = () => { const k = b.dataset.sort; sort = { k, dir: sort.k === k ? -sort.dir : (k === "name" ? 1 : -1) }; usersTable(box); });
  wireTests(box);
  box.querySelectorAll("tr.u").forEach(tr => {
    const flip = () => { const id = tr.dataset.u; open.has(id) ? open.delete(id) : open.add(id); usersTable(box); };
    tr.onclick = flip;
    tr.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } };
  });
}
function details(u) {
  const facts = [["Plan", u.plan ? (u.plan === "pro" ? "Pro" : "Max") : "free"], ["Born", u.birth_year || "–"], ["Said they came from", esc(u.source || "–")],
    ["Marketing emails", u.marketing ? "yes" : "no"], ["Last sign-in", when(u.last_login_at)], ["Joined", when(u.created_at)]];
  const course = c => `<div class="kz-course"><b>${esc(c.title || c.slug || "Course not out yet")}</b>${stagePill(c.stage)}<br>
    ${c.status ? `Order: ${esc(ORDER_STATUS[c.status] || c.status)}${c.paid ? " · paid" : ""}<br>` : "Joined with a code<br>"}
    Levels: ${num(c.levels)}${c.lessons ? ` of ${num(c.lessons)}` : ""} · ${num(c.slides)} slides · cost ${usd(c.cost)}<br>
    Last active: ${when(c.lastActive)}${c.slug ? `<br><span style="font-size:12px">${esc(c.slug)}</span>` : ""}
    ${c.slug && c.title ? `<br>${testBtn(c.slug)}` : ""}</div>`;
  return `<div class="kz-facts">${facts.map(([k, v]) => `<span>${k}: <b>${v}</b></span>`).join("")}</div>
    <div class="kz-courses">${u.courses.length ? u.courses.map(course).join("") : `<span class="kz-muted">No course queued yet.</span>`}</div>`;
}

// "Test as student" (Marek, 2026-11-19): opens the course in a new tab as its test student (pc-api test_student). Same course
// and version the student sees, with its own progress, so their progress is never touched. The app in this browser then runs
// as that test student until you sign in there again. Courses without an order count as paid, so the store isn't shown.
const testBtn = slug => `<button class="kz-btn" data-test="${esc(slug)}" title="Opens this course as a test student in a new tab. The student's own progress isn't touched.">Test as student</button>`;
function wireTests(el) {
  el.querySelectorAll("[data-test]").forEach(b => b.onclick = async e => {
    e.stopPropagation(); // inside a Users row: don't fold it
    const slug = b.dataset.test, tab = window.open("about:blank", "_blank"); // opened in the click, so it isn't blocked as a pop-up
    b.disabled = true;
    try {
      const { session } = await call("test_student", { slug });
      store.set("session", { token: session, slug });
      store.set("readySeen", slug);
      if (tab) tab.location.href = `./#/s/${encodeURIComponent(slug)}`; else location.href = `./#/s/${encodeURIComponent(slug)}`;
    } catch (err) {
      tab?.close();
      note = `<span class="kz-err">Test as student failed: ${esc(err.code || err.message)}</span>`; paint();
    } finally { b.disabled = false; }
  });
}

// ---------- Orders & courses tab ----------
const stageText = o => {
  if (o.status !== "building" || !o.progress) return "";
  const age = o.progress_at ? Math.round((Date.now() - new Date(o.progress_at)) / 60000) : 0;
  return ` · ${esc(o.progress.stage)} ${o.progress.done}/${o.progress.total}${age >= 3 ? ` · no update for ${age} min` : ""}`;
};
function paintOrders(el) {
  if (!data) { el.innerHTML = `<p class="kz-muted">Loading…</p>`; return; }
  const bySlug = {};
  for (const s of data.students) (bySlug[s.slug] ||= []).push(s);
  const tbl = (head, rows) => `<div class="kz-scroll"><table><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr>${rows}</table></div>`;
  el.innerHTML = `
  <div class="kz-grid">${card(`Orders <small>latest ${num(data.orders.length)}</small>`, tbl(["Status", "Course", "Plan", "Files", "Bought", "Ready"],
    data.orders.map(o => `<tr><td>${esc(o.status)}${stageText(o)}</td><td>${esc(o.slug || "–")}</td><td>${esc(o.plan_id || "–")}</td><td>${esc(o.files.join(", "))}${o.pages ? ` <span class="kz-muted">~${o.pages} pp</span>` : ""}</td><td>${when(o.paid_at)}</td><td>${when(o.ready_at)}</td></tr>`).join("")), { flush: true })}</div>
  <div class="kz-grid">${card(`Courses <small>${num(data.courses.length)}</small>`, tbl(["Course", "Items", "Version", "Students", "Voice", ""],
    data.courses.map(c => `<tr><td><b>${esc(c.title)}</b><span class="sub">${esc(c.slug)}</span></td><td>${total(c.counts)}</td><td>${c.version}</td><td>${(bySlug[c.slug] || []).length}</td><td>${c.voice ? (c.voice_agent_id ? "on" : "on, no agent yet") : "off"}</td><td><button data-voice="${esc(c.slug)}" data-on="${c.voice ? "" : "1"}">${c.voice ? "Turn voice off" : "Turn voice on"}</button> ${testBtn(c.slug)}</td></tr>`).join("")), { flush: true })}</div>
  <div class="kz-grid">${card(`Students <small>${num(data.students.length)}</small>`, tbl(["Course", "Tutor", "Exam", "Joined", "Last activity", "Voice min", ""],
    data.students.map(s => `<tr><td>${esc(s.slug)}${s.is_test ? ` <span class="kz-pill">test</span>` : ""}</td><td>${esc(s.tutor_id || "–")}</td><td>${esc(s.exam_date || "–")}</td><td>${when(s.created_at)}</td><td>${when(s.lastActivity)}</td><td>${mins(s.voiceUsedSeconds)} of ${mins(s.voice_cap_seconds)}${s.voiceUnsettled ? ` <span class="kz-muted">(${s.voiceUnsettled} unsettled)</span>` : ""}</td><td><button data-reset="${esc(s.id)}">Reset code</button><button data-grant="${esc(s.id)}">+60 min</button></td></tr>`).join("")), { flush: true })}</div>
  <p class="kz-foot">Accounts with names, emails and phones are in the Users tab.</p>`;
  el.querySelectorAll("[data-reset]").forEach(b => b.onclick = async () => {
    if (!confirm("New code for this student? The old code and open sessions stop working.")) return;
    await act(async () => { const { code } = await call("code_reset", { studentId: b.dataset.reset }); note = `New code, shown once: <span class="kz-code">${esc(code)}</span>`; });
  });
  el.querySelectorAll("[data-grant]").forEach(b => b.onclick = () => act(async () => { const { capSeconds } = await call("voice_grant", { studentId: b.dataset.grant, seconds: 3600 }); note = `Voice cap is now ${mins(capSeconds)} min.`; }));
  wireTests(el);
  el.querySelectorAll("[data-voice]").forEach(b => b.onclick = () => act(async () => { await call("course_voice", { slug: b.dataset.voice, voice: !!b.dataset.on }); note = `Voice ${b.dataset.on ? "on" : "off"} for ${esc(b.dataset.voice)}.`; }));
}
async function act(fn) {
  try { await fn(); await loadOrders(); }
  catch (e) { note = `<span class="kz-err">Failed: ${esc(e.code || e.message)}</span>`; }
  paint();
}
login();

// Admin page (kvizoo.com/app/admin.html). The key stays in memory only, so a reload asks again.
// Stats tab (2026-11-18): visitors, where they came from, accounts, Stripe sales, slides, per period against the period before.
//   Visits come from web/hit.js (no cookies); sales are paid Stripe invoices, so test clicks and refunds are not in them.
// Orders & people tab: orders, courses, accounts (with marketing consent), students, voice minutes, code reset.
import { esc, api } from "./util.js";

const root = document.getElementById("ad");
let key = null, data = null, stats = null, note = "", tab = "stats", days = 30, busy = false;
try { days = [1, 7, 30, 90].includes(+localStorage.getItem("pc.admin.days")) ? +localStorage.getItem("pc.admin.days") : 30; } catch { /* default */ }
const call = (name, body = {}) => api("admin_" + name, { adminKey: key, ...body });
const when = v => v ? new Date(v).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" }) : "–";
const mins = s => `${Math.round((s || 0) / 60)}`;
const total = c => ["flashcard", "mc", "tf", "fill", "match"].reduce((n, k) => n + (c?.[k] || 0), 0);
const num = v => new Intl.NumberFormat("en-GB").format(v ?? 0);
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dayLabel = d => DAY.format(new Date(d + "T12:00:00Z"));
const pragueDay = v => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date(v));
const money = m => Object.entries(m || {}).filter(([, v]) => v).map(([c, v]) =>
  new Intl.NumberFormat(c === "czk" ? "cs-CZ" : "en-US", { style: "currency", currency: c.toUpperCase(), maximumFractionDigits: c === "czk" ? 0 : 2 }).format(v)).join(" + ") || "0";
const notrack = () => { try { return !!localStorage.getItem("pc.notrack"); } catch { return false; } };
const setNotrack = on => { try { on ? localStorage.setItem("pc.notrack", "1") : localStorage.removeItem("pc.notrack"); } catch { /* blocked */ } };

function login(err = "") {
  root.innerHTML = `<h1>Kvizoo admin</h1><form class="ad-login" id="f">
    <input type="text" name="username" autocomplete="username" value="kvizoo-admin" hidden>
    <input id="k" name="password" type="password" autocomplete="current-password" placeholder="Admin key" aria-label="Admin key">
    <button class="btn block">Open</button><p class="ad-err" role="alert">${esc(err)}</p></form>`;
  document.getElementById("f").onsubmit = async e => {
    e.preventDefault();
    key = document.getElementById("k").value.trim();
    try { await loadStats(); setNotrack(true); paint(); } // this browser is Marek's: its visits stop counting (the box on the page undoes it)
    catch (er) { key = null; login(er.code === "too_many" ? "Too many tries. Wait 10 minutes." : "That key doesn't work."); }
  };
}
async function loadStats() { stats = await call("stats", { days }); }
async function load() { data = await call("overview"); }

// ---------- frame: tabs, period, the "don't count me" box ----------
function paint() {
  const tabBtn = (id, label) => `<button data-tab="${id}" aria-pressed="${tab === id}">${label}</button>`;
  root.innerHTML = `<div class="ad-top"><h1>Kvizoo admin</h1><div class="ad-tabs">${tabBtn("stats", "Stats")}${tabBtn("people", "Orders &amp; people")}</div></div>
  ${note ? `<div class="ad-note">${note}</div>` : ""}<div id="body"></div>`;
  note = "";
  root.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => go(b.dataset.tab));
  const body = root.querySelector("#body");
  if (tab === "stats") paintStats(body); else paintPeople(body);
}
async function go(t) {
  if (busy) return;
  tab = t;
  if (t === "people" && !data) { busy = true; root.querySelector("#body").innerHTML = `<p class="ad-muted">Loading…</p>`; try { await load(); } catch (e) { note = `<span class="ad-err">Failed: ${esc(e.code || e.message)}</span>`; } busy = false; }
  paint();
}
async function period(d) {
  if (busy) return;
  busy = true; days = d;
  try { localStorage.setItem("pc.admin.days", String(d)); } catch { /* fine */ }
  root.querySelectorAll("[data-days]").forEach(b => { b.disabled = true; b.setAttribute("aria-pressed", String(+b.dataset.days === d)); });
  try { await loadStats(); } catch (e) { note = `<span class="ad-err">Failed: ${esc(e.code || e.message)}</span>`; }
  busy = false; paint();
}

// ---------- Stats tab ----------
const vsText = () => days === 1 ? "vs yesterday by this time" : `vs the ${days} days before`;
function delta(cur, prev) {
  if (prev == null || cur == null) return "";
  if (cur === prev) return `<span class="ad-muted">same ${vsText().replace(/^vs /, "as ")}</span>`;
  const up = cur > prev, d = Math.abs(cur - prev), pct = prev ? ` (${up ? "+" : "−"}${Math.round(d / prev * 100)}%)` : "";
  return `<span class="${up ? "ad-up" : "ad-down"}" aria-label="${up ? "up" : "down"}">${up ? "▲" : "▼"}</span> ${up ? "+" : "−"}${num(d)}${pct} <span class="ad-muted">${vsText()}</span>`;
}
const tile = (label, value, sub, d = "") => `<div class="ad-kpi"><div class="l">${label}</div><div class="v">${value}</div>${d ? `<div class="s">${d}</div>` : ""}${sub ? `<div class="s ad-muted">${sub}</div>` : ""}</div>`;

// Nice round gridlines: up to 4 steps of 1, 2 or 5 × 10^k, whole numbers only.
function scale(max) {
  if (!(max > 0)) return { top: 4, step: 1 };
  const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw)), step = Math.max(1, [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw));
  return { top: Math.ceil(max / step) * step, step };
}
// One series per chart, bars per day, one y axis, hover or tap for the day's numbers; a table view under it.
//   rows: [{ label, v, tip }]; tip is HTML for the tooltip.
let chartId = 0;
function bars(title, rows, { h = 160, note: foot = "" } = {}) {
  const id = "c" + ++chartId, { top, step } = scale(Math.max(0, ...rows.map(r => r.v)));
  const grid = [];
  for (let t = 0; t <= top; t += step) grid.push(t);
  const every = rows.length <= 10 ? 1 : Math.ceil(rows.length / 6), n = rows.length;
  const xs = rows.map((r, i) => (n - 1 - i) % every === 0 ? `<span style="left:${(i + .5) / n * 100}%">${esc(r.label)}</span>` : "").join("");
  charts[id] = rows;
  return `<div class="ad-card"><h3>${title}</h3>
    <div class="ad-ch" style="--h:${h}px">
      <div class="ad-y" aria-hidden="true">${grid.map(t => `<span style="bottom:${t / top * 100}%">${num(t)}</span>`).join("")}</div>
      <div class="ad-plot" data-chart="${id}" role="img" aria-label="${esc(title)}: ${rows.map(r => `${r.label} ${r.v}`).join(", ")}">
        ${grid.slice(1).map(t => `<div class="ad-gl" style="bottom:${t / top * 100}%"></div>`).join("")}
        <div class="ad-cols"${n > 45 ? ' style="gap:1px"' : ""}>${rows.map(r => `<div class="ad-col"><i style="height:${r.v / top * 100}%"${r.v ? "" : ' class="z"'}></i></div>`).join("")}</div>
        <div class="ad-tip" hidden></div>
      </div>
      <div class="ad-x" aria-hidden="true">${xs}</div>
    </div>
    ${foot ? `<p class="ad-foot">${foot}</p>` : ""}
    <details class="ad-tv"><summary>Show as table</summary><div class="ad-scroll"><table><tr><th>Day</th><th class="n">${esc(title)}</th></tr>
      ${rows.map(r => `<tr><td>${esc(r.label)}</td><td class="n">${num(r.v)}</td></tr>`).join("")}</table></div></details></div>`;
}
const charts = {};
function wireCharts(el) {
  hiders = [];
  el.querySelectorAll("[data-chart]").forEach(plot => {
    const rows = charts[plot.dataset.chart], tip = plot.querySelector(".ad-tip"), cols = plot.querySelectorAll(".ad-col");
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
let hiders = [];
document.addEventListener("pointerdown", e => { for (const [plot, hide] of hiders) if (!plot.contains(e.target)) hide(); });
// Horizontal bars for a few named rows (the funnel, slide sizes): label, bar against the largest, number, share.
const hbars = (rows, { pctOf = null } = {}) => {
  const max = Math.max(1, ...rows.map(r => r[1])), base = pctOf ?? max;
  return `<div class="ad-h">${rows.map(([label, v, sub]) => `<div class="hl">${label}${sub ? `<br><span class="ad-muted">${sub}</span>` : ""}</div>
    <div class="hb"><i style="width:${v / max * 100}%"${v ? "" : ' class="z"'}></i></div><div class="hn">${num(v)}${pctOf != null && base ? ` <span class="ad-muted">${Math.round(v / base * 100)}%</span>` : ""}</div>`).join("")}</div>`;
};
// A table of counts with a thin share bar in the first number column.
function countTable(head, rows, { share = 1 } = {}) {
  const max = Math.max(1, ...rows.map(r => +r[share] || 0));
  return `<div class="ad-scroll"><table><tr>${head.map((h, i) => `<th${i ? ' class="n"' : ""}>${h}</th>`).join("")}${share ? "<th></th>" : ""}</tr>
    ${rows.length ? rows.map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ""}>${i ? num(c) : c}</td>`).join("")}${share ? `<td class="ad-sh">${+r[share] ? `<i style="width:${r[share] / max * 100}%"></i>` : ""}</td>` : ""}</tr>`).join("")
    : `<tr><td colspan="${head.length + 1}" class="ad-muted">Nothing yet in this period.</td></tr>`}</table></div>`;
}
const SOURCE_NOTE = { direct: "typed in, a bookmark, or an app that hides where it came from", unknown: "account made before visits were counted, or no visit found that day" };
const srcLabel = s => `<b>${esc(s)}</b>${SOURCE_NOTE[s] ? `<br><span class="ad-muted">${SOURCE_NOTE[s]}</span>` : ""}`;
const PAGE_NAMES = {
  "/": "Landing (kvizoo.com)", "/app/": "App: welcome", "/app/new": "Setup", "/app/new/files": "Setup 1: slides", "/app/new/date": "Setup 2: exam date",
  "/app/new/tutor": "Setup 3: tutor", "/app/new/source": "Setup 4: where from", "/app/new/notify": "Setup 5: reminders", "/app/new/account": "Setup 6: account",
  "/app/s": "Course home", "/app/s/lesson": "Lesson", "/app/s/practice": "Practice", "/app/s/review": "Review", "/app/s/test": "Test", "/app/s/notes": "Notes",
  "/app/s/progress": "Progress", "/app/s/settings": "Course settings", "/app/unlock": "Plans and prices", "/app/paid": "After paying", "/app/wait": "Course being made",
  "/app/login": "Sign in", "/app/t": "Tester link", "/priprava-na-zkousky/": "Exam prep: all schools",
};
const pageLabel = p => `${esc(PAGE_NAMES[p] || (p.startsWith("/priprava-na-zkousky/") ? "Exam prep: " + p.split("/")[2].toUpperCase() : p))}<br><span class="ad-muted">${esc(p)}</span>`;
const KIND = { new: "new subscription", renewal: "renewal", change: "plan change", other: "other" };

function paintStats(el) {
  if (!stats) { el.innerHTML = `<p class="ad-muted">Loading…</p>`; return; }
  for (const k in charts) delete charts[k];
  const s = stats, T = s.totals || {}, P = s.prev || {}, pay = s.pay || {}, now = s.now || {};
  const pd = (label, d) => `<button data-days="${d}" aria-pressed="${days === d}">${label}</button>`;
  const since = now.trackingSince ? pragueDay(now.trackingSince) : null;
  const byDay = pay.byDay || {};
  const daily = (s.daily || []).map(d => ({ ...d, sales: byDay[d.day]?.n || 0, fresh: byDay[d.day]?.fresh || 0 }));
  const today = pragueDay(Date.now());
  const lbl = d => dayLabel(d.day) + (d.day === today ? " (today so far)" : "");
  const tipFor = d => `<b>${lbl(d)}</b><br>${num(d.visitors)} visitors · ${num(d.visits)} from outside · ${num(d.views)} page views<br>${num(d.signups)} new accounts · ${num(d.uploads)} uploads · ${num(d.sales)} sales`;
  const paying = now.paying || [], payingN = paying.reduce((a, p) => a + p.n, 0);
  const payingBy = paying.map(p => `${p.n} ${p.plan === "pro" ? "Pro" : "Max"} (${p.currency.toUpperCase()})`).join(", ");
  const sl = s.slides || {}, B = sl.buckets || [0, 0, 0, 0, 0];
  const dict = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]);
  const devWords = { mobile: "Phone", tablet: "Tablet", desktop: "Computer", "?": "Unknown" };

  el.innerHTML = `
  <div class="ad-bar"><div class="ad-seg" role="group" aria-label="Period">${pd("Today", 1)}${pd("7 days", 7)}${pd("30 days", 30)}${pd("90 days", 90)}<button data-refresh>Refresh</button></div>
    <label class="ad-check"><input type="checkbox" id="nt"${notrack() ? " checked" : ""}> Don't count my visits from this browser</label></div>
  ${!since ? `<p class="ad-note">Visit counting starts with the first visitor after this update. Accounts, sales and slides below already go back further.</p>`
    : since > (daily[0]?.day || since) ? `<p class="ad-foot">Visits counted since ${dayLabel(since)}; days before that show no visitors.</p>` : ""}
  <div class="ad-kpis">
    ${tile("Visitors", num(T.visitors), `${num(T.visits)} visits from outside · ${num(T.views)} page views`, delta(T.visitors, P.visitors))}
    ${tile("New accounts", num(T.signups), "", delta(T.signups, P.signups))}
    ${pay.error ? tile("Sales", "?", esc(pay.error)) : tile("Sales", num(pay.cur.n), `${num(pay.cur.fresh)} new subscriptions · ${num(pay.cur.n - pay.cur.fresh)} renewals and changes`, delta(pay.cur.n, pay.prev.n))}
    ${pay.error ? tile("Revenue", "?", "Stripe didn't answer") : tile("Revenue", money(pay.cur.money), `before: ${money(pay.prev.money)} · paid invoices in Stripe, refunds not taken off`)}
    ${tile("Slides uploaded", num(T.slides), `${num(T.uploaded)} uploads · ${num(T.started)} setups started`, delta(T.slides, P.slides))}
    ${tile("Opened a course", num(T.studied), "visitors on a course page", delta(T.studied, P.studied))}
  </div>
  <div class="ad-now"><span><b>${num(payingN)}</b> paying now${payingBy ? ` <span class="ad-muted">(${esc(payingBy)})</span>` : ""}</span>
    <span><b>${money(s.mrr)}</b> a month from them</span><span><b>${num(now.accounts)}</b> accounts in all</span>
    <span><b>${num(now.testers)}</b> testers on a free plan</span><span><b>${num(now.studying7)}</b> courses studied in the last 7 days</span></div>

  ${bars("Visitors per day", daily.map(d => ({ label: dayLabel(d.day), v: d.visitors, tip: tipFor(d) })), { note: "A visitor is one browser on one address on one day; the same person tomorrow counts again." })}
  <div class="ad-grid3">
    ${bars("New accounts per day", daily.map(d => ({ label: dayLabel(d.day), v: d.signups, tip: tipFor(d) })), { h: 90 })}
    ${bars("Uploads per day", daily.map(d => ({ label: dayLabel(d.day), v: d.uploads, tip: tipFor(d) })), { h: 90 })}
    ${pay.error ? `<div class="ad-card"><h3>Sales per day</h3><p class="ad-err">${esc(pay.error)}</p></div>` : bars("Sales per day", daily.map(d => ({ label: dayLabel(d.day), v: d.sales, tip: tipFor(d) })), { h: 90 })}
  </div>

  <div class="ad-grid2">
    <div class="ad-card"><h3>From visit to sale</h3>
      ${hbars([["Visitors", T.visitors || 0], ["Began setup", T.started || 0], ["Uploaded slides", T.uploaded || 0], ["Made an account", T.signups || 0], ["Bought a plan", pay.error ? 0 : pay.cur.fresh]], { pctOf: T.visitors || 0 })}
      <p class="ad-foot">Each step is counted over the same period, not the same people followed one by one. % is of visitors.</p></div>
    <div class="ad-card"><h3>Slides per upload</h3>
      ${hbars([["Up to 20", B[0]], ["21 to 50", B[1]], ["51 to 100", B[2]], ["101 to 250", B[3]], ["Over 250", B[4]]])}
      <p class="ad-foot">${num(sl.uploads)} uploads · ${num(sl.files)} files · ${num(sl.total)} slides · average ${num(sl.avg)} · median ${num(sl.median)} · largest ${num(sl.max)}</p></div>
  </div>

  <h2>Where visitors came from</h2>
  ${countTable(["Source", "Visits", "Visitors", "Accounts", "Paying"], (s.sources || []).map(r => [srcLabel(r.source), r.visits, r.visitors, r.signups, r.paying]))}
  <p class="ad-foot">Tag your links so they show up here by name: <code>kvizoo.com/?utm_source=tiktok&amp;utm_campaign=bio</code> (or short: <code>?ref=tt</code>). Accounts are matched to the visit from the same browser that day.</p>
  <div class="ad-grid2">
    <div><h2>What they said at sign-up</h2>${countTable(["Answer", "Accounts"], dict(s.said).map(([k, v]) => [esc(k), v]))}</div>
    <div><h2>Tagged links</h2>${countTable(["Campaign", "Visits"], (s.campaigns || []).map(c => [`<b>${esc(c.campaign)}</b><br><span class="ad-muted">${esc(c.source)}</span>`, c.visits]))}</div>
  </div>
  <h2>Pages</h2>
  ${countTable(["Page", "Views", "Visitors", "Landed here"], (s.pages || []).map(p => [pageLabel(p.path), p.views, p.visitors, p.entries]))}
  <div class="ad-grid3">
    <div><h2>Devices</h2>${countTable(["Device", "Visitors"], dict(s.devices).map(([k, v]) => [devWords[k] || esc(k), v]))}</div>
    <div><h2>Languages</h2>${countTable(["Browser language", "Visitors"], dict(s.langs).map(([k, v]) => [esc(k === "?" ? "unknown" : k), v]))}</div>
    ${Object.keys(s.countries || {}).some(k => k !== "?") // Supabase's edge sends no country header today, so this stays hidden until it does
    ? `<div><h2>Countries</h2>${countTable(["Country", "Visitors"], dict(s.countries).map(([k, v]) => [esc(k === "?" ? "unknown" : k), v]))}</div>` : ""}
  </div>
  <h2>Payments in Stripe</h2>
  ${pay.error ? `<p class="ad-err">${esc(pay.error)}</p>` : `<div class="ad-scroll"><table><tr><th>Paid</th><th class="n">Amount</th><th>Plan</th><th>What</th><th>Email</th></tr>
    ${(pay.list || []).length ? pay.list.map(p => `<tr><td>${when(p.at)}</td><td class="n">${money({ [p.currency]: p.amount })}</td><td>${esc(p.plan || "–")}</td><td>${KIND[p.kind] || esc(p.kind)}</td><td>${esc(p.email || "–")}</td></tr>`).join("")
    : `<tr><td colspan="5" class="ad-muted">No payments in this period.</td></tr>`}</table></div>`}
  <p class="ad-foot">Updated ${when(s.to)} · period from ${when(s.from)}</p>`;

  el.querySelectorAll("[data-days]").forEach(b => b.onclick = () => period(+b.dataset.days));
  el.querySelector("[data-refresh]").onclick = () => period(days);
  el.querySelector("#nt").onchange = e => setNotrack(e.target.checked);
  wireCharts(el);
}

// ---------- Orders & people tab ----------
const stageText = o => {
  if (o.status !== "building" || !o.progress) return "";
  const age = o.progress_at ? Math.round((Date.now() - new Date(o.progress_at)) / 60000) : 0;
  return ` · ${esc(o.progress.stage)} ${o.progress.done}/${o.progress.total}${age >= 3 ? ` · no update for ${age} min` : ""}`;
};
// Accounts and buyers per "how did you hear about Penny" answer. Bought = the account has a paid order among the latest 50 or Pro.
function sourceRows() {
  const paid = new Set(data.orders.filter(o => o.paid_at && o.account_id).map(o => o.account_id)), rows = {};
  for (const a of data.accounts || []) { const r = rows[a.source || "–"] ||= [0, 0]; r[0]++; if (paid.has(a.id) || (a.pro_until && Date.parse(a.pro_until) > Date.now())) r[1]++; }
  return Object.entries(rows).sort((x, y) => y[1][0] - x[1][0]).map(([s, [n, b]]) => `<tr><td>${esc(s)}</td><td>${n}</td><td>${b}</td></tr>`).join("");
}
function paintPeople(el) {
  if (!data) { el.innerHTML = `<p class="ad-muted">Loading…</p>`; return; }
  const bySlug = {};
  for (const s of data.students) (bySlug[s.slug] ||= []).push(s);
  el.innerHTML = `
  <h2>Orders (${data.orders.length})</h2>
  <div class="ad-scroll"><table><tr><th>Status</th><th>Course</th><th>Plan</th><th>Files</th><th>Bought</th><th>Ready</th></tr>
  ${data.orders.map(o => `<tr><td>${esc(o.status)}${stageText(o)}</td><td>${esc(o.slug || "–")}</td><td>${esc(o.plan_id || "–")}</td><td>${esc(o.files.join(", "))}${o.pages ? ` <span class="ad-muted">~${o.pages} pp</span>` : ""}</td><td>${when(o.paid_at)}</td><td>${when(o.ready_at)}</td></tr>`).join("")}</table></div>
  <h2>Courses (${data.courses.length})</h2>
  <div class="ad-scroll"><table><tr><th>Course</th><th>Items</th><th>Version</th><th>Students</th><th>Voice</th><th></th></tr>
  ${data.courses.map(c => `<tr><td><b>${esc(c.title)}</b><br><span class="ad-muted">${esc(c.slug)}</span></td><td>${total(c.counts)}</td><td>${c.version}</td><td>${(bySlug[c.slug] || []).length}</td><td>${c.voice ? (c.voice_agent_id ? "on" : "on, no agent yet") : "off"}</td><td><button data-voice="${esc(c.slug)}" data-on="${c.voice ? "" : "1"}">${c.voice ? "Turn voice off" : "Turn voice on"}</button></td></tr>`).join("")}</table></div>
  <h2>Where accounts came from (their answer)</h2>
  <div class="ad-scroll"><table><tr><th>Source</th><th>Accounts</th><th>Bought</th></tr>${sourceRows()}</table></div>
  <h2>Accounts (${(data.accounts || []).length})</h2>
  <div class="ad-scroll"><table><tr><th>Name</th><th>Email</th><th>Phone</th><th>Born</th><th>Source</th><th>Marketing</th><th>Joined</th><th>Last login</th></tr>
  ${(data.accounts || []).map(a => `<tr><td>${esc(a.name)}</td><td>${esc(a.email)}</td><td>${esc(a.phone || "–")}</td><td>${a.birth_year || "–"}</td><td>${esc(a.source || "–")}</td><td>${a.marketing ? `yes, ${when(a.marketing_at)}` : "no"}</td><td>${when(a.created_at)}</td><td>${when(a.last_login_at)}</td></tr>`).join("")}</table></div>
  <h2>Students (${data.students.length})</h2>
  <div class="ad-scroll"><table><tr><th>Course</th><th>Tutor</th><th>Exam</th><th>Joined</th><th>Last activity</th><th>Voice min</th><th></th></tr>
  ${data.students.map(s => `<tr><td>${esc(s.slug)}</td><td>${esc(s.tutor_id || "–")}</td><td>${esc(s.exam_date || "–")}</td><td>${when(s.created_at)}</td><td>${when(s.lastActivity)}</td><td>${mins(s.voiceUsedSeconds)} of ${mins(s.voice_cap_seconds)}${s.voiceUnsettled ? ` <span class="ad-muted">(${s.voiceUnsettled} unsettled)</span>` : ""}</td><td><button data-reset="${esc(s.id)}">Reset code</button><button data-grant="${esc(s.id)}">+60 min</button></td></tr>`).join("")}</table></div>`;
  el.querySelectorAll("[data-reset]").forEach(b => b.onclick = async () => {
    if (!confirm("New code for this student? The old code and open sessions stop working.")) return;
    await act(async () => { const { code } = await call("code_reset", { studentId: b.dataset.reset }); note = `New code, shown once: <span class="ad-code">${esc(code)}</span>`; });
  });
  el.querySelectorAll("[data-grant]").forEach(b => b.onclick = () => act(async () => { const { capSeconds } = await call("voice_grant", { studentId: b.dataset.grant, seconds: 3600 }); note = `Voice cap is now ${mins(capSeconds)} min.`; }));
  el.querySelectorAll("[data-voice]").forEach(b => b.onclick = () => act(async () => { await call("course_voice", { slug: b.dataset.voice, voice: !!b.dataset.on }); note = `Voice ${b.dataset.on ? "on" : "off"} for ${esc(b.dataset.voice)}.`; }));
}
async function act(fn) {
  try { await fn(); await load(); }
  catch (e) { note = `<span class="ad-err">Failed: ${esc(e.code || e.message)}</span>`; }
  paint();
}
login();

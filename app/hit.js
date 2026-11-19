// Counts page views on kvizoo.com for the Stats tab of admin.html (2026-11-18).
// No cookies and nothing saved on this device: pc-api turns address + browser into a code that changes every day.
// Sends only on kvizoo.com (never localhost, never another site) and never from a browser where admin.html set pc.notrack.
// The landing page and the exam pages count themselves on load; the app (data-manual) calls pcHit("/app/...") per screen.
(function () {
  var API = "https://mlgedjxcoqaccbzxtmsu.supabase.co/functions/v1/pc-api";
  var me = document.currentScript, last = null, first = true;
  var on = /(^|\.)kvizoo\.com$/.test(location.hostname);
  try { if (localStorage.getItem("pc.notrack")) on = false; } catch (e) { /* storage blocked: still count */ }
  function hit(path) {
    path = String(path || "/").slice(0, 120);
    if (!on || path === last) return;
    last = path;
    var b = { action: "hit", path: path };
    // Only the first view of a page load says where the visitor came from (the link's tag and the referring site).
    // A friend link's code (?t=<code>) never leaves the page here: it shows as t=- (the app counts the open as /app/t instead).
    if (first) { first = false; b.first = true; b.ref = String(document.referrer || "").slice(0, 500); b.q = location.search.replace(/([?&]t=)[^&#]*/g, "$1-").slice(0, 300); }
    var body = JSON.stringify(b);
    try { if (navigator.sendBeacon && navigator.sendBeacon(API, body)) return; } catch (e) { /* fall through */ }
    try { fetch(API, { method: "POST", body: body, keepalive: true, mode: "no-cors" }).catch(function () {}); } catch (e) { /* never break the page */ }
  }
  window.pcHit = hit;
  if (!(me && me.hasAttribute("data-manual"))) hit(location.pathname);
})();

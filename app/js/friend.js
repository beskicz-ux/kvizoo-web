// Friend links: the links Marek sends early students for a free plan (lifetime PRO for feedback). No I/O, so Node tests run it.
// Send kvizoo.com/app/?t=<CODE> (2026-11-19). The old kvizoo.com/app/#/t/<CODE> still works, but it lost its code on the way to
// tester monta from an Instagram DM: the part after # never reached the app. A ?t= link has no # for Instagram to drop.
export const FRIEND_PARAM = "t";

// The same clean-up as pc-api's normCode, cut to the 20 characters a code can have: "ab-12 cd" is AB12CD.
export const cleanCode = s => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);

// The friend code in a page address, from ?t=<code> (form "query") or #/t/<code> (form "hash"); null when there is neither.
// A link with the marker but no usable code gives code "", so the app can count it as a broken link.
// #/reset?t=<token> (the password email) is not a friend link: only ?t= before the # counts.
export function friendCodeFrom(search, hash) {
  let q = null;
  try { q = new URLSearchParams(String(search || "")).get(FRIEND_PARAM); } catch { /* junk address: no code */ }
  if (q !== null) return { code: cleanCode(q), form: "query" };
  const m = String(hash || "").match(/^#?\/?t(?:\/([^/?#]*))?(?:[/?#]|$)/);
  if (m) {
    let raw = m[1] || "";
    try { raw = decodeURIComponent(raw); } catch { /* keep it as it came */ }
    return { code: cleanCode(raw), form: "hash" };
  }
  return null;
}

// The query string with ?t= set to the code, or taken out (code ""), every other part kept: "?utm_source=ig&t=AB12".
export function withFriend(search, code) {
  let p;
  try { p = new URLSearchParams(String(search || "")); } catch { p = new URLSearchParams(); }
  p.delete(FRIEND_PARAM);
  if (code) p.set(FRIEND_PARAM, code);
  const s = p.toString();
  return s ? "?" + s : "";
}
export const withoutFriend = search => withFriend(search, "");

// The link to send for a code. app is pc-api's APP ("https://kvizoo.com/app/").
export const friendLink = (app, code) => `${app}?${FRIEND_PARAM}=${cleanCode(code)}`;

// What the app says after pc-api answered a code (redeemInvite's gift): an i18n key, or null for nothing to say.
export const GIFT_TEXT = { ok: "giftOk", bad: "friendBad", full: "friendFull", have: "friendHave" };

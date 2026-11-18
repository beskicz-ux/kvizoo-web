// Where a slide's picture lives, shared by the app and the builder so they always agree (2026-11-18).
// The builder renders each slide page a question or reading cites to a JPEG in the private pc-courses bucket at
// <slug>/slides/<key>/<page>.jpg, where key is a short hash of the file's name as the student uploaded it (NFC, as in the course's
// sources). The app asks pc-api (slide_urls) for signed links by "<key>/<page>"; a page with no picture comes back null.
// No DOM and no imports here: Node imports this file too.
export function slideKey(name) { // FNV-1a over code points, 8 hex digits
  let h = 0x811c9dc5;
  for (const ch of String(name).normalize("NFC")) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
// "<key>/<page>" for an item's or reading's source, or "" when it names no file and page.
export const slideRef = s => s?.file && Number.isInteger(s.page) && s.page >= 1 && s.page <= 9999 ? `${slideKey(s.file)}/${s.page}` : "";
export const SLIDE_REF = /^[0-9a-f]{8}\/[1-9]\d{0,3}$/; // pc-api checks the same shape

// The camera inside the app (Marek 2026-11-27: "make it like 'vyfotit zápisky' so it opens camera and lets user take photos
// that are automatically then inside the app"). A full-screen live view of the back camera, one tap per page, a thumbnail with
// the count; Done (or the cross) hands the shots back as JPEGs, which the files step turns into one photo PDF in the list.
// Nothing is uploaded while shooting. When the camera can't start (refused, no camera, an old browser) it says so and offers
// the old way instead: the phone's own camera page by page, or photos picked on a computer.
import { t } from "./i18n.js";
import { ic, buzz } from "./util.js";

export const canCamera = () => !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia);

export function openCamera({ onDone, fallback, fallbackLabel }) {
  const el = document.createElement("div");
  el.className = "cam"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", t("filesSnap"));
  el.innerHTML = `<video class="cam-v" playsinline muted autoplay></video><i class="cam-flash"></i>
    <div class="cam-top"><button type="button" class="cam-x" aria-label="${t("close")}">${ic.x}</button><p class="cam-hint">${t("camHint")}</p></div>
    <div class="cam-fail" hidden><p>${t("camFail")}</p><button type="button" class="btn-p cam-alt">${fallbackLabel}</button></div>
    <div class="cam-bar"><span class="cam-thumb" hidden><img alt=""><b></b></span><button type="button" class="cam-shut" aria-label="${t("camShoot")}" disabled><i></i></button><button type="button" class="cam-done" hidden>${t("camDone")}</button></div>`;
  document.body.append(el); document.documentElement.classList.add("cam-on");
  const $ = s => el.querySelector(s), video = $(".cam-v"), shots = [], urls = [];
  let stream = null, closed = false;
  const stop = () => { stream?.getTracks().forEach(tr => tr.stop()); stream = null; };
  // Whatever was shot goes in: the cross and Done both keep the photos (a wrong one is removed from the list, like any file).
  const close = (keep = true) => {
    if (closed) return; closed = true;
    stop(); el.remove(); document.documentElement.classList.remove("cam-on");
    removeEventListener("hashchange", left); removeEventListener("keydown", key);
    Promise.all(shots).then(blobs => {
      urls.forEach(u => URL.revokeObjectURL(u));
      const files = blobs.filter(Boolean).map((b, i) => new File([b], `foto-${String(i + 1).padStart(3, "0")}.jpg`, { type: "image/jpeg" }));
      if (keep && files.length) onDone(files);
    });
  };
  const left = () => close(false); // the student left the step: let the camera go, the page is gone
  const key = e => { if (e.key === "Escape") close(); };
  addEventListener("hashchange", left); addEventListener("keydown", key);
  $(".cam-x").onclick = () => close();
  $(".cam-done").onclick = () => close();
  $(".cam-alt").onclick = () => { close(); fallback(); };
  const fail = () => { stop(); el.classList.add("cam-off"); $(".cam-fail").hidden = false; $(".cam-shut").disabled = true; };
  navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1920 } } })
    .then(async s => {
      if (closed) return s.getTracks().forEach(tr => tr.stop());
      stream = s; video.srcObject = s;
      await video.play().catch(() => { });
      s.getVideoTracks()[0]?.addEventListener("ended", fail);
      $(".cam-shut").disabled = false; $(".cam-shut").focus();
    })
    .catch(fail);
  $(".cam-shut").onclick = () => {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h || closed) return;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(video, 0, 0, w, h);
    buzz(12);
    el.classList.remove("cam-snap"); void el.offsetWidth; el.classList.add("cam-snap");
    const shot = new Promise(res => c.toBlob(res, "image/jpeg", .9));
    shots.push(shot);
    const n = shots.length;
    shot.then(b => {
      if (!b || closed) return;
      const u = URL.createObjectURL(b); urls.push(u);
      const th = $(".cam-thumb");
      th.querySelector("img").src = u; th.querySelector("b").textContent = n; th.hidden = false; $(".cam-done").hidden = false;
      th.classList.remove("cam-in"); void th.offsetWidth; th.classList.add("cam-in"); // not .pop: that is the quiz popover
    });
  };
}

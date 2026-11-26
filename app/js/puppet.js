// Penny as a puppet: one drawing (art.js ham with the rig parts), six states switched by a class.
//   const p = puppet({ size: 96, state: "idle" }); parent.append(p.el);
//   p.setState("correct");   // idle | correct | wrong | talk | cheer | sleep
//   p.tap();
// correct and wrong fall back by themselves to the last lasting state. The moves are in base.css (.ham.rig).
import { ham } from "./art.js";

const STATES = ["idle", "correct", "wrong", "talk", "cheer", "sleep"];
const BACK = { correct: 1300, wrong: 1300 };

function puppet({ size = 96, state = "idle", cls = "" } = {}) {
  const el = document.createElement("span");
  el.className = "puppet" + (cls ? " " + cls : "");
  el.style.width = el.style.height = size + "px";
  el.innerHTML = ham("open", "", true);
  const svg = el.firstElementChild;
  let timer = 0, lasting = "idle";
  const show = s => { for (const x of STATES) svg.classList.toggle("s-" + x, x === s); el.dataset.state = s; };
  function setState(s) {
    if (!STATES.includes(s)) return;
    clearTimeout(timer);
    if (BACK[s]) timer = setTimeout(() => show(lasting), BACK[s]); else lasting = s;
    show(s);
  }
  function tap() {
    svg.classList.remove("tap");
    void svg.getBoundingClientRect(); // restart the animation
    svg.classList.add("tap");
  }
  el.addEventListener("click", tap);
  setState(state);
  return { el, setState, tap };
}

export { puppet, STATES };

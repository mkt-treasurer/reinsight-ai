import { PRETENDARD_VAR_WOFF2 } from "./fontData";

/**
 * Pretendard Variable is injected as a data URI @font-face with font-display:block.
 *
 * Deliberately NOT wrapped in delayRender(): both FontFace().load() and
 * document.fonts.load() intermittently never settled inside Remotion's render
 * tabs (timers are patched for deterministic rendering), which killed long
 * renders around frame 1700-3500. A data URI needs no network round trip, so
 * the face is available as soon as the stylesheet is parsed — well before the
 * first frame is captured.
 */
const style = document.createElement("style");
style.textContent = `@font-face{
  font-family:'Pretendard';
  src:url(data:font/woff2;base64,${PRETENDARD_VAR_WOFF2}) format('woff2-variations');
  font-weight:45 920;
  font-style:normal;
  font-display:block;
}`;
document.head.appendChild(style);

export {};

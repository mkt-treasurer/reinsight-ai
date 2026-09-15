import { chromium } from "playwright-core";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "public", "shots");
mkdirSync(OUT, { recursive: true });
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const TARGETS = [
  { name: "grid-card",  needle: "SK하이닉스",   minW: 480, minH: 260, maxW: 900 },
  { name: "sources",    needle: "SEC EDGAR",   minW: 380, minH: 240, maxW: 900 },
  { name: "chat-card",  needle: "영업이익률",   minW: 320, minH: 220, maxW: 900 },
  { name: "agents",     needle: "Orchestrator", minW: 380, minH: 240, maxW: 900 },
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
await page.goto("https://alpha-lenz.com", { waitUntil: "networkidle", timeout: 90000 });
for (let y = 0; y < 9500; y += 600) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(140);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(4000);

for (const t of TARGETS) {
  const sel = await page.evaluate(({ needle, minW, minH, maxW }) => {
    const leaf = [...document.querySelectorAll("*")].find(
      (e) => e.children.length === 0 && (e.textContent || "").includes(needle));
    if (!leaf) return null;
    let node = leaf;
    while (node && node !== document.body) {
      const r = node.getBoundingClientRect();
      const cls = (node.className || "").toString();
      if (r.width >= minW && r.width <= maxW && r.height >= minH && /rounded|border/.test(cls)) break;
      node = node.parentElement;
    }
    if (!node || node === document.body) return null;
    const id = "cap-" + Math.random().toString(36).slice(2, 9);
    node.setAttribute("data-cap", id);
    node.scrollIntoView({ block: "center" });
    return `[data-cap="${id}"]`;
  }, t);
  if (!sel) { console.log("MISS", t.name); continue; }
  await page.waitForTimeout(3000);
  const el = page.locator(sel).first();
  const box = await el.boundingBox();
  await el.screenshot({ path: path.join(OUT, `${t.name}.png`) });
  console.log("OK  ", t.name, Math.round(box.width) + "x" + Math.round(box.height));
}
await browser.close();

/** 최종 컷에 맞춘 나레이션 대본 문서를 만든다. */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const t = JSON.parse(readFileSync(path.join(root, "src/timing.json"), "utf8"));
const j = JSON.parse(readFileSync(path.join(root, "src/script.json"), "utf8"));

const tc = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 60000))}:${p(Math.floor(ms / 1000) % 60)}`;
};

const NAME = {
  "s1-hook": "훅 · 모더나 +177%",
  "s2-spread": "국내 확산 → 질문",
  "s3-trial": "이번 임상은 뭐가 달랐나",
  "s4-caveat": "아직 안 나온 것들",
  "s5-why": "왜 177%였나",
  "s6-distance": "세 회사 비교 (본론)",
  "s8-alphalenz": "주가는 올랐는데 계약은?",
  "s9-close": "마무리",
};

const NOTE = {
  "s1-hook": "툭 던지듯. 마지막 “하루 만에요”에서 한 박자 쉬기",
  "s2-spread": "둘째 줄은 질문이니 끝을 살짝 올려서",
  "s3-trial": "설명 구간. 평이하게 가되 숫자만 또박또박",
  "s4-caveat": "톤을 한 단계 낮춰서. 조심스럽게",
  "s5-why": "다시 올려서. 마지막 줄이 이 구간의 결론",
  "s6-distance": "회사 이름은 힘줘서. 세 줄이 같은 리듬으로 반복되게",
  "s8-alphalenz": "“없었어요”에서 멈춤. 여기가 반전 지점",
  "s9-close": "광고 톤. 마지막은 권유하듯 부드럽게",
};

const RATE = 5.2;
const syl = (s) =>
  (s.match(/[가-힣]/g) || []).length + (s.match(/\d/g) || []).length * 1.5;

const md = [
  "# 나레이션 대본",
  "",
  "최종본 `alphalenz-mrna-connection-distance.mp4` (2분 25초) 기준.",
  `전 ${j.scenes.reduce((a, s) => a + s.cues.length, 0)}줄 · 약 ${Math.round(
    j.scenes.flatMap((s) => s.cues).reduce((a, c) => a + syl(c.vo), 0)
  )}음절 · 낭독 기준 5.2음절/초.`,
  "",
  "**할당**은 그 자막이 화면에 떠 있는 시간입니다. 이 안에 들어가면 재렌더 없이 그대로 얹힙니다.",
  "넘치면 알려주세요 — 녹음 길이에 맞춰 영상을 다시 뽑으면 됩니다.",
  "",
  "---",
  "",
];

let n = 0;
for (let si = 0; si < t.scenes.length; si++) {
  const ts = t.scenes[si];
  const sj = j.scenes[si];
  md.push(`## ${tc(ts.from / t.fps)}  ${NAME[ts.id]}`, "", `> ${NOTE[ts.id]}`, "");
  md.push("| # | 시작 | 할당 | 대사 |", "|---|---|---|---|");
  ts.cues.forEach((c, i) => {
    n++;
    const st = (ts.from + c.fromInScene) / t.fps;
    const d = c.framesInScene / t.fps;
    const need = syl(sj.cues[i].vo) / RATE;
    md.push(
      `| ${n} | \`${tc(st)}\` | ${d.toFixed(1)}s <sub>(${need.toFixed(1)}s)</sub> | ${sj.cues[i].vo} |`
    );
  });
  md.push("");
}

md.push(
  "---",
  "",
  "괄호 안은 5.2음절/초로 읽었을 때 예상 소요입니다. 전부 할당 안에 들어갑니다.",
  "",
  "## 읽기용 (복붙)",
  "",
  "```"
);
let k = 0;
for (const s of j.scenes)
  s.cues.forEach((c) => {
    k++;
    md.push(`${String(k).padStart(2)}. ${c.vo}`);
  });
md.push("```", "");

writeFileSync(path.join(root, "NARRATION-SCRIPT.md"), md.join("\n"));
writeFileSync(
  path.join(root, "나레이션-읽기용.txt"),
  j.scenes.flatMap((s) => s.cues.map((c) => c.vo)).join("\n") + "\n",
  "utf8"
);
console.log(`NARRATION-SCRIPT.md · 나레이션-읽기용.txt  (${n}줄)`);

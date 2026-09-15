import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { EdgeTTS } from "node-edge-tts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "out");
const W = 1920;
const H = 1080;

mkdirSync(OUT, { recursive: true });

const fontRegular = readFileSync("C:/Windows/Fonts/malgun.ttf");
const fontBold = readFileSync("C:/Windows/Fonts/malgunbd.ttf");

const C = {
  bg: "#0B1020",
  panel: "#141A2E",
  line: "#2A3354",
  text: "#F4F6FF",
  muted: "#9AA3C2",
  purple: "#7A65FF",
  purpleDim: "#2C2758",
  green: "#12C48A",
  red: "#FF5C7A",
  white: "#FFFFFF",
};

function el(type, props = {}, ...children) {
  const flat = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  const style = {
    display: "flex",
    flexDirection: "column",
    ...props.style,
  };
  if (!props.style?.flexDirection && props.style?.display === "flex") {
    style.flexDirection = "row";
  }
  return {
    type,
    props: {
      ...props,
      style,
      children: flat.length === 1 ? flat[0] : flat,
    },
  };
}

const scenes = [
  {
    id: "01-hook",
    vo: "8월 19일, 모더나 주가가 하루 만에 백칠십칠 퍼센트 올랐습니다. 다음 날 한국 장에서는 소마젠이 상한가를 찍고, 엠알엔에이 관련주가 한꺼번에 움직였습니다. 질문은 하나입니다. 같은 이름표면, 같은 이야기일까요?",
    render: () =>
      frame([
        eyebrow("ISSUE  08.19 US  →  08.20 KR"),
        el("div", { style: { display: "flex", flexDirection: "column", marginTop: 28 } },
          el("div", { style: { color: C.muted, fontSize: 36, letterSpacing: 4 } }, "MODERNA  MRNA"),
          el("div", {
            style: {
              color: C.green,
              fontSize: 220,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -6,
            },
          }, "+177%"),
          el("div", { style: { color: C.text, fontSize: 48, marginTop: 8 } }, "하루 만에 반영된 임상 3상 뉴스"),
        ),
        el("div", {
          style: {
            display: "flex",
            gap: 16,
            marginTop: 56,
          },
        },
          chip("소마젠 상한가"),
          chip("삼양바이오팜"),
          chip("mRNA 테마 동반 상승"),
        ),
        questionBar("같은 ‘관련주’면, 같은 영향일까?"),
      ]),
  },
  {
    id: "02-trial",
    vo: "계기는 모더나와 머크가 함께 만든 개인 맞춤형 엠알엔에이 암 백신, 임상 3상입니다. 환자 종양을 읽고, 그 암의 특징만 면역계에 알려줍니다. 고위험 피부암 환자 천백삼십칠 명에게 기존 면역항암제 키트루다와 함께 투여했고, 재발과 전이를 늦추는 목표를 모두 달성했습니다. 후기 임상에서 처음입니다.",
    render: () =>
      frame([
        eyebrow("WHAT CHANGED"),
        title("예방 백신이 아니라, 맞춤형 표적 정보"),
        el("div", { style: { display: "flex", gap: 20, marginTop: 36 } },
          step("01", "종양 분석", "환자 암세포의 특징을 읽는다"),
          step("02", "mRNA 설계", "그 사람만의 백신을 만든다"),
          step("03", "면역 전달", "키트루다와 함께 투여한다"),
        ),
        el("div", { style: { display: "flex", gap: 24, marginTop: 40 } },
          stat("1,137명", "고위험 피부암 · 수술 후"),
          stat("Phase 3", "재발·전이 목표 달성"),
          stat("First", "후기 임상 mRNA 암백신"),
        ),
      ]),
  },
  {
    id: "03-caveat",
    vo: "다만 위험이 몇 퍼센트 줄었는지, 생존 기간이 늘었는지는 아직 공개되지 않았습니다. 임상적으로 매우 중요한 진전이지, 허가가 난 것은 아닙니다.",
    render: () =>
      frame([
        eyebrow("READ THE RESULT CAREFULLY"),
        title("중요한 진전 ≠ 상용화 확정"),
        el("div", { style: { display: "flex", gap: 28, marginTop: 48 } },
          colBox("달성한 것", C.green, [
            "재발을 늦추는 핵심 목표",
            "다른 장기로의 전이 감소 목표",
            "후기 임상에서 처음 나온 신호",
          ]),
          colBox("아직 없는 것", C.muted, [
            "위험 감소 폭의 상세 수치",
            "전체 생존기간 연장 여부",
            "규제 허가 · 매출 확정",
          ]),
        ),
      ]),
  },
  {
    id: "04-why",
    vo: "그런데 왜 주가는 백칠십칠 퍼센트나 뛰었을까요. 모더나는 코로나 이후 성장 엔진이 비어 있었습니다. 올해 2분기 매출은 약 1억 달러, 순손실은 약 8억 달러. 시장이 묻던 질문은 하나였습니다. 엠알엔에이는 코로나를 넘어서도 사업이 되는가. 이번 결과는 제품 하나가 아니라, 암 치료 플랫폼의 가능성을 높인 답이었습니다.",
    render: () =>
      frame([
        eyebrow("WHY THE STOCK MOVED"),
        title("시장이 산 것은 제품이 아니라 플랫폼"),
        el("div", { style: { display: "flex", gap: 28, marginTop: 40 } },
          el("div", {
            style: {
              flex: 1,
              backgroundColor: C.panel,
              border: `1px solid ${C.line}`,
              borderRadius: 20,
              padding: "36px 40px",
              display: "flex",
              flexDirection: "column",
            },
          },
            el("div", { style: { color: C.muted, fontSize: 26 } }, "모더나 2026 2Q"),
            kpiRow("매출", "약 1억 달러"),
            kpiRow("순손실", "약 8억 달러", true),
            el("div", { style: { color: C.muted, fontSize: 26, marginTop: 20 } }, "코로나 수요 감소 이후, 다음 성장축이 필요했다"),
          ),
          el("div", {
            style: {
              flex: 1.15,
              backgroundColor: C.purpleDim,
              border: `1px solid ${C.purple}`,
              borderRadius: 20,
              padding: "36px 40px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            },
          },
            el("div", { style: { color: C.purple, fontSize: 24, letterSpacing: 3 } }, "THE QUESTION"),
            el("div", { style: { color: C.text, fontSize: 40, fontWeight: 700, lineHeight: 1.4, marginTop: 16 } },
              "mRNA 기술이\n코로나 백신을 넘어\n사업이 될 수 있는가?"),
            el("div", { style: { color: C.green, fontSize: 28, marginTop: 28 } }, "폐암 · 유방암 · 췌장암으로 확장 중인 같은 방식"),
          ),
        ),
      ]),
  },
  {
    id: "05-distance",
    vo: "그래서 관심은 한국 엠알엔에이 관련주로도 번졌습니다. 하지만 연결의 거리는 회사마다 다릅니다. 소마젠은 과거 모더나와 유전체 분석 공급 이력이 있습니다. 관심은 가지만, 이번 암 백신 생산이나 임상에 참여한다고 단정할 수는 없습니다. 삼양바이오팜은 자체 후보물질 에스와이피 이일삼오를 개발 중입니다. 기술 방향은 같지만, 아직 전임상입니다. 삼성바이오로직스는 엠알엔에이 완제 생산 역량이 있습니다. 코로나 백신을 만든 경험이지, 이번 암 백신을 만든다는 뜻은 아닙니다.",
    render: () =>
      frame([
        eyebrow("THEME ≠ LINK"),
        title("관련주라는 이름표보다, 연결의 거리"),
        el("div", { style: { display: "flex", gap: 20, marginTop: 36 } },
          companyCard("소마젠", "과거 거래", "모더나 유전체 분석 공급 이력", "이번 암백신 생산·임상 참여로 단정 불가", "거리 있음"),
          companyCard("삼양바이오팜", "자체 개발", "mRNA 암백신 SYP-2135", "같은 기술 방향, 아직 전임상", "초기 단계"),
          companyCard("삼성바이오로직스", "생산 역량", "코로나 mRNA 완제 생산 경험", "이번 암백신 수주를 의미하진 않음", "역량 ≠ 계약"),
        ),
      ]),
  },
  {
    id: "06-earnings",
    vo: "뉴스와 실적도 한 번 더 분리해야 합니다. 삼성바이오로직스 2분기 매출 1조 3,209억, 영업이익 5,864억. 회사가 밝힌 성장 요인은 공장 가동률과 환율입니다. 이번 임상이 만든 숫자가 아닙니다.",
    render: () =>
      frame([
        eyebrow("NEWS VS EARNINGS"),
        title("테마가 주가를 움직여도, 실적은 공장에서 난다"),
        el("div", { style: { display: "flex", gap: 24, marginTop: 44 } },
          bigNum("매출", "1조 3,209억", "전년 동기 대비 +30%"),
          bigNum("영업이익", "5,864억", "전년 동기 대비 +23%"),
        ),
        el("div", {
          style: {
            marginTop: 36,
            backgroundColor: C.panel,
            borderRadius: 16,
            padding: "28px 36px",
            display: "flex",
            flexDirection: "column",
            border: `1px solid ${C.line}`,
          },
        },
          el("div", { style: { color: C.muted, fontSize: 24 } }, "삼성바이오로직스 2026 2Q · 회사가 밝힌 성장 요인"),
          el("div", { style: { color: C.text, fontSize: 40, fontWeight: 700, marginTop: 10 } }, "1~4공장 높은 가동률  +  환율 효과"),
          el("div", { style: { color: C.purple, fontSize: 28, marginTop: 12 } }, "모더나 암백신 임상 성공이 만든 실적이 아님"),
        ),
      ]),
  },
  {
    id: "07-close",
    vo: "관련주가 올랐다는 사실보다 중요한 건, 왜 관련주로 묶였는지입니다. 뉴스에서 실적까지, 그 거리를 재세요. 알파렌즈였습니다.",
    render: () =>
      frame([
        eyebrow("ALPHA LENZ TAKE"),
        el("div", {
          style: {
            marginTop: 70,
            display: "flex",
            flexDirection: "column",
          },
        },
          el("div", { style: { color: C.muted, fontSize: 32 } }, "볼 것"),
          el("div", {
            style: {
              color: C.text,
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.25,
              marginTop: 12,
            },
          }, "관련주가 아니라\n연결의 거리"),
          el("div", { style: { color: C.purple, fontSize: 36, marginTop: 36 } },
            "계약인가 · 매출인가 · 파이프라인 몇 단계인가"),
        ),
        el("div", {
          style: {
            position: "absolute",
            left: 80,
            bottom: 70,
            display: "flex",
            flexDirection: "column",
          },
        },
          el("div", { style: { color: C.text, fontSize: 28, fontWeight: 700, letterSpacing: 6 } }, "ALPHA LENZ"),
          el("div", { style: { color: C.muted, fontSize: 22, marginTop: 8 } }, "뉴스에서 실적까지, 한 칸 더 확인합니다"),
        ),
      ], true),
  },
];

function frame(children, noDisclaimer = false) {
  return el("div", {
    style: {
      width: W,
      height: H,
      backgroundColor: C.bg,
      color: C.text,
      display: "flex",
      flexDirection: "column",
      padding: "56px 80px 48px 80px",
      position: "relative",
      fontFamily: "Malgun",
    },
  },
    el("div", {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: 8,
        height: H,
        backgroundColor: C.purple,
      },
    }),
    el("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      },
    },
      el("div", { style: { display: "flex", alignItems: "center", gap: 14 } },
        el("div", { style: { width: 14, height: 14, backgroundColor: C.purple, borderRadius: 3 } }),
        el("div", { style: { fontSize: 26, fontWeight: 700, letterSpacing: 5 } }, "ALPHA LENZ"),
      ),
      el("div", { style: { color: C.muted, fontSize: 22, letterSpacing: 2 } }, "BRIEFING  ·  mRNA"),
    ),
    ...children,
    noDisclaimer ? null : el("div", {
      style: {
        position: "absolute",
        right: 80,
        bottom: 40,
        color: "#6B7394",
        fontSize: 18,
      },
    }, "정보 제공 목적 · 투자 권유 아님"),
  );
}

function eyebrow(text) {
  return el("div", {
    style: {
      marginTop: 54,
      color: C.purple,
      fontSize: 24,
      fontWeight: 700,
      letterSpacing: 4,
    },
  }, text);
}

function title(text) {
  return el("div", {
    style: {
      marginTop: 16,
      fontSize: 52,
      fontWeight: 700,
      lineHeight: 1.3,
    },
  }, text);
}

function chip(text) {
  return el("div", {
    style: {
      backgroundColor: C.panel,
      border: `1px solid ${C.line}`,
      borderRadius: 999,
      padding: "14px 28px",
      fontSize: 28,
      color: C.text,
    },
  }, text);
}

function questionBar(text) {
  return el("div", {
    style: {
      marginTop: 48,
      backgroundColor: C.purpleDim,
      borderLeft: `6px solid ${C.purple}`,
      padding: "22px 28px",
      fontSize: 34,
      fontWeight: 700,
    },
  }, text);
}

function step(n, h, s) {
  return el("div", {
    style: {
      flex: 1,
      backgroundColor: C.panel,
      borderRadius: 20,
      padding: "28px 30px",
      border: `1px solid ${C.line}`,
      display: "flex",
      flexDirection: "column",
    },
  },
    el("div", { style: { color: C.purple, fontSize: 22, fontWeight: 700 } }, n),
    el("div", { style: { color: C.text, fontSize: 36, fontWeight: 700, marginTop: 12 } }, h),
    el("div", { style: { color: C.muted, fontSize: 26, marginTop: 10, lineHeight: 1.4 } }, s),
  );
}

function stat(k, v) {
  return el("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
    },
  },
    el("div", { style: { color: C.green, fontSize: 44, fontWeight: 700 } }, k),
    el("div", { style: { color: C.muted, fontSize: 24, marginTop: 6 } }, v),
  );
}

function colBox(h, accent, items) {
  return el("div", {
    style: {
      flex: 1,
      backgroundColor: C.panel,
      borderRadius: 20,
      padding: "36px 40px",
      border: `1px solid ${C.line}`,
      display: "flex",
      flexDirection: "column",
    },
  },
    el("div", { style: { color: accent, fontSize: 28, fontWeight: 700 } }, h),
    ...items.map((t) =>
      el("div", { style: { color: C.text, fontSize: 32, marginTop: 22, lineHeight: 1.35 } }, "·  " + t),
    ),
  );
}

function kpiRow(label, value, loss = false) {
  return el("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 22,
      paddingBottom: 14,
      borderBottom: `1px solid ${C.line}`,
    },
  },
    el("div", { style: { color: C.muted, fontSize: 30 } }, label),
    el("div", { style: { color: loss ? C.red : C.text, fontSize: 36, fontWeight: 700 } }, value),
  );
}

function companyCard(name, tag, a, b, dist) {
  return el("div", {
    style: {
      flex: 1,
      backgroundColor: C.panel,
      borderRadius: 20,
      padding: "28px 26px",
      border: `1px solid ${C.line}`,
      display: "flex",
      flexDirection: "column",
    },
  },
    el("div", { style: { color: C.purple, fontSize: 20, fontWeight: 700, letterSpacing: 1 } }, tag),
    el("div", { style: { color: C.text, fontSize: 36, fontWeight: 700, marginTop: 10 } }, name),
    el("div", { style: { color: C.text, fontSize: 24, marginTop: 18, lineHeight: 1.4 } }, a),
    el("div", { style: { color: C.muted, fontSize: 22, marginTop: 12, lineHeight: 1.4 } }, b),
    el("div", {
      style: {
        marginTop: 24,
        color: C.green,
        fontSize: 22,
        fontWeight: 700,
      },
    }, dist),
  );
}

function bigNum(label, value, sub) {
  return el("div", {
    style: {
      flex: 1,
      backgroundColor: C.panel,
      borderRadius: 20,
      padding: "36px 40px",
      border: `1px solid ${C.line}`,
      display: "flex",
      flexDirection: "column",
    },
  },
    el("div", { style: { color: C.muted, fontSize: 26 } }, label),
    el("div", { style: { color: C.text, fontSize: 64, fontWeight: 700, marginTop: 10 } }, value),
    el("div", { style: { color: C.green, fontSize: 28, marginTop: 12 } }, sub),
  );
}

async function pngFromTree(tree, file) {
  const svg = await satori(tree, {
    width: W,
    height: H,
    fonts: [
      { name: "Malgun", data: fontRegular, weight: 400, style: "normal" },
      { name: "Malgun", data: fontBold, weight: 700, style: "normal" },
    ],
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: W } });
  writeFileSync(file, resvg.render().asPng());
}

function ffprobeDuration(file) {
  const r = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ], { encoding: "utf8" });
  return parseFloat(r.stdout.trim());
}

function ffmpeg(args) {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(r.stderr?.slice(-2000) || "ffmpeg failed");
  }
}

async function ttsToFile(text, file) {
  const tts = new EdgeTTS({
    voice: "ko-KR-InJoonNeural",
    lang: "ko-KR",
    outputFormat: "audio-24khz-48kbitrate-mono-mp3",
    rate: "-8%",
    timeout: 120000,
  });
  await tts.ttsPromise(text, file);
}

async function main() {
  const parts = [];
  for (const scene of scenes) {
    const mp3 = path.join(OUT, `${scene.id}.mp3`);
    const png = path.join(OUT, `${scene.id}.png`);
    const mp4 = path.join(OUT, `${scene.id}.mp4`);
    console.log("scene", scene.id);
    await ttsToFile(scene.vo, mp3);
    await pngFromTree(scene.render(), png);
    const dur = ffprobeDuration(mp3);
    ffmpeg([
      "-y",
      "-loop", "1",
      "-i", png,
      "-i", mp3,
      "-vf", `zoompan=z='min(1.06,1+0.00035*on)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30,format=yuv420p`,
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "18",
      "-c:a", "aac",
      "-b:a", "192k",
      "-t", dur.toFixed(3),
      "-shortest",
      "-movflags", "+faststart",
      mp4,
    ]);
    parts.push(mp4);
  }

  const list = path.join(OUT, "concat.txt");
  writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
  const finalMp4 = path.join(__dirname, "alphalenz-moderna-mrna-related.mp4");
  ffmpeg([
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", list,
    "-c", "copy",
    finalMp4,
  ]);

  const thumbTree = scenes[0].render();
  await pngFromTree(thumbTree, path.join(__dirname, "thumbnail-1920x1080.png"));
  ffmpeg([
    "-y",
    "-i", path.join(__dirname, "thumbnail-1920x1080.png"),
    "-vf", "scale=1280:720",
    path.join(__dirname, "thumbnail-1280x720.png"),
  ]);

  const total = ffprobeDuration(finalMp4);
  console.log("DONE", finalMp4, "duration", total.toFixed(1), "s");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

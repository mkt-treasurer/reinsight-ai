import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { SalesStage } from "../SalesStage";
import { stage, font } from "../../theme";
import { fadeUp, pop } from "../../util";
import { endingBeats, endingSlogan, PHASES } from "../salesData";

const FPS = 30;

// 105–110s. The four verbs, then the slogan.
export const N9Ending: React.FC = () => {
  const frame = useCurrentFrame();
  const slogan = fadeUp(frame, 74, 20, 16);
  const lockup = fadeUp(frame, 96, 20, 12);
  const rule = interpolate(frame, [80, 104], [0, 420], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SalesStage bare>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 120px" }}>
        {/* four verbs */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
          {endingBeats.map((b, i) => {
            const p = pop(frame, 6 + i * 12, FPS);
            return (
              <React.Fragment key={b.en}>
                <div
                  style={{
                    textAlign: "center",
                    padding: "0 34px",
                    opacity: p,
                    transform: `translateY(${(1 - p) * 18}px)`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: font.mono,
                      fontSize: 10,
                      letterSpacing: "0.26em",
                      color: stage.accentBright,
                      marginBottom: 14,
                    }}
                  >
                    {PHASES[i]}
                  </div>
                  <div
                    style={{
                      fontFamily: font.head,
                      fontSize: 30,
                      fontWeight: 800,
                      color: stage.ink,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {b.en}
                  </div>
                  <div style={{ fontSize: 16, color: stage.inkMuted, marginTop: 9 }}>{b.ko}</div>
                </div>
                {i < endingBeats.length - 1 && (
                  <div style={{ width: 1, background: stage.hair, opacity: p, alignSelf: "stretch" }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div style={{ width: rule, height: 1, background: stage.hair, margin: "54px 0 44px" }} />

        {/* slogan */}
        <div
          style={{
            textAlign: "center",
            opacity: slogan.opacity,
            transform: `translateY(${slogan.translateY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: font.head,
              fontSize: 42,
              fontWeight: 800,
              color: stage.ink,
              letterSpacing: "-0.02em",
            }}
          >
            {endingSlogan}
          </div>
        </div>

        {/* lockup */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: lockup.opacity,
            transform: `translateY(${lockup.translateY}px)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <div style={{ width: 13, height: 13, background: stage.accent, transform: "rotate(45deg)" }} />
            <span
              style={{
                fontFamily: font.head,
                fontWeight: 800,
                fontSize: 32,
                letterSpacing: "0.38em",
                color: stage.ink,
              }}
            >
              TREASURER
            </span>
            <span
              style={{
                fontFamily: font.head,
                fontWeight: 800,
                fontSize: 32,
                letterSpacing: "0.2em",
                color: stage.accentBright,
              }}
            >
              INS
            </span>
          </div>
          <span
            style={{
              fontFamily: font.body,
              fontSize: 15,
              color: stage.inkMuted,
              marginTop: 16,
            }}
          >
            보험중개사의 영업 · 계약 및 정산을 하나로 연결하는 AI 플랫폼
          </span>
        </div>
      </AbsoluteFill>
    </SalesStage>
  );
};

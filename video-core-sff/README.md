# video-core-sff

30-second promo for **Core by Treasurer**, made for the Singapore FinTech Festival booth.
Gold-on-black motion graphics alternate with muted clips from `core-demo-draft7.mp4`.
Reads fully with sound off.

## Structure

| # | Scene | What happens |
|---|-------|--------------|
| 1 | Intro (native) | Glowing tile with the O mark, then the vector lockup sharpens in with a gold light sweep |
| 2 | Print day (native, 3s) | Typed headline "7:10 am. Print day."; the PM's three questions land one by one |
| 3–5 | Ask 1+2 → Answer 1 → Answer 2 | Typed prompt box; guide-vs-ours cards with count-ups; last quarter's previews card |
| 6–7 | Ask 3 → Answer 3 | The X post drops into Check; three claim cards with odds and bars |
| 8–9 | Notes → Reply | Two contradicting-note rows; typed reply with attachment chips |
| 10 | Six minutes | 00:00 → 06:00 counter with stat chips |
| 11 | Private (native) | Your data. Your model. Your machine. + three tiles |
| 12 | End (footage) | "Ask. It's done." lockup, kept as the final shot |

Scenes 3–10 ("beats", `src/scenes/Beats.tsx`) follow the reference ad's pattern: the demo footage is
pushed back as a blurred, dimmed, slowly tilting 3D stage (cropped so its burned-in caption is off-frame),
with one serif headline on top and native animated cards in front. Every cut has a transition: fade,
slide, wipe, or the gold hairline wipe in `src/transitions.tsx`.

```
public/clips/core-demo-draft7.mp4   source demo (not committed) — see "Source prep" below
public/music.mp3                    optional, picked up automatically by `npm run render`
src/Lockup.tsx                      Core by Treasurer lockup as text + SVG (sharp at any size)
src/fontData.ts                     embedded Pretendard, copied from video-treasurer-pr30
src/cut.json                        the cut: scenes, clip in/out points, headline copy, transitions
```

```bash
npm install
npm run render     # -> out/core-sff-30s.mp4
npm run frames     # -> out/frames/NN-<scene>.jpg + sheet.jpg, one still per scene
npm run studio     # live preview
```

## Source prep

Remotion's compositor intermittently fails on the raw export with "No frame found at position"
(seeks between keyframes). Re-encode it once as all-keyframes before rendering; seeking then
never misses. This also drops the audio, which the film mutes anyway:

```bash
ffmpeg -i ~/Downloads/core-demo-draft7.mp4 -vf "fps=30,format=yuv420p" -an -c:v libx264 -preset fast -crf 16 -g 1 -keyint_min 1 -movflags +faststart public/clips/core-demo-draft7.mp4
```


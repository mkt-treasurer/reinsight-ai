# video-core-sff

30-second promo for **Core by Treasurer**, made for the Singapore FinTech Festival booth.
Gold-on-black motion graphics alternate with muted clips from `core-demo-draft7.mp4`.
Reads fully with sound off.

## Structure

| # | Scene | What happens |
|---|-------|--------------|
One function, one story: the guidance tracker, told as problem → solution. (Rumor check is a
separate film.)

| # | Scene | What happens |
|---|-------|--------------|
| 1 | Intro (native, 2s) | Glowing tile with the O mark, then the vector lockup with a gold light sweep |
| 2 | Print day (native) | Typed headline; the PM's two questions land one by one and hold for 3s+ |
| 3 | Problem (native) | "Normally, that's the analyst's whole morning." Clock races, filings and old notes pile up |
| 4 | The ask | Typed prompt: "Build a guidance tracker for NVDA, with what our previews expected." |
| 5 | Tracker (footage, unblurred) | The real report, 15.0–17.5s of the demo |
| 6 | Answer 1 | Guide vs ours cards, then the verdict strip: 3 of 3 printed above range, so we likely run low |
| 7 | Answer 2 | Previews vs the print: (1.9%) avg, low 2 of 2, from our own notes |
| 8 | Sources | 7 sources, 4 public filings + the internal preview note in gold |
| 9 | Done | 00:00 → 06:00 counter; 2 questions · 1 request · 0 manual steps |
| 10 | Private (native) | "Because Core reads your own notes, on your own machine." + three tiles |
| 11 | End (footage) | "Ask. It's done." lockup, kept as the final shot |

Footage-backed scenes ("beats", `src/scenes/Beats.tsx`) follow the reference ad's pattern: the demo
footage is pushed back as a blurred, dimmed, slowly tilting 3D stage (cropped so its burned-in caption
is off-frame), with one serif headline on top and native animated cards in front. Every cut has a
transition: fade, slide, wipe, or the gold hairline wipe in `src/transitions.tsx`. Captions never
overlap: each fades out (0.2s) before the transition and the next fades in (0.3s) after it
(`captionWindow` in `src/timeline.ts`).

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


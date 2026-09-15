// Browser-side loader for the slip PDF's embedded font + letterhead images.
//
// jsPDF can only draw Korean text if a Korean-glyph font is embedded in the
// document. The full Nanum Gothic TTFs (~2MB each) are served from
// `/public/fonts` and fetched lazily HERE — at PDF-generation time — so they
// never enter the main JS bundle. Decoded base64 + image data URLs are cached
// after first use so repeat exports in a session don't re-download.

import type { jsPDF } from "jspdf";

export const SLIP_FONT_FAMILY = "NanumGothic";

const REGULAR_URL = "/fonts/NanumGothic-Regular.ttf";
const BOLD_URL = "/fonts/NanumGothic-Bold.ttf";

let fontCache: { regular: string; bold: string } | null = null;
let imageCache: { logoDataUrl?: string; signatureDataUrl?: string } | null = null;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000; // avoid arg-count limits on String.fromCharCode
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font fetch failed (${res.status}) — ${url}`);
  return toBase64(await res.arrayBuffer());
}

/**
 * Register Nanum Gothic (regular + bold) into `pdf` and return the family name
 * to pass as `SlipAssets.fontFamily`. Fetches the TTFs on first call, caches
 * the base64 for the rest of the session. Throws if the fonts can't be loaded
 * (the caller surfaces the error — a Korean slip without the font would render
 * as blank glyphs, so failing loudly is correct).
 */
export async function registerSlipFont(pdf: jsPDF): Promise<string> {
  if (!fontCache) {
    const [regular, bold] = await Promise.all([
      fetchBase64(REGULAR_URL),
      fetchBase64(BOLD_URL),
    ]);
    fontCache = { regular, bold };
  }
  pdf.addFileToVFS("NanumGothic-Regular.ttf", fontCache.regular);
  pdf.addFont("NanumGothic-Regular.ttf", SLIP_FONT_FAMILY, "normal");
  pdf.addFileToVFS("NanumGothic-Bold.ttf", fontCache.bold);
  pdf.addFont("NanumGothic-Bold.ttf", SLIP_FONT_FAMILY, "bold");
  return SLIP_FONT_FAMILY;
}

async function fetchDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return undefined; // logo/signature are optional — degrade gracefully
  }
}

/** Best-effort load of the letterhead logo + signature as data URLs (cached). */
export async function loadSlipImages(): Promise<{
  logoDataUrl?: string;
  signatureDataUrl?: string;
}> {
  if (!imageCache) {
    const [logoDataUrl, signatureDataUrl] = await Promise.all([
      fetchDataUrl("/ins_logo.png"),
      fetchDataUrl("/ins_signature.png"),
    ]);
    imageCache = { logoDataUrl, signatureDataUrl };
  }
  return imageCache;
}

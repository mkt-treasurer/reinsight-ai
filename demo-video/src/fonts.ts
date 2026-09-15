import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadJetBrains } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadNotoKR } from "@remotion/google-fonts/NotoSansKR";

// Load once at module import; Remotion waits for these before rendering frames.
loadMontserrat("normal", { weights: ["600", "700", "800"], subsets: ["latin"] });
loadJetBrains("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });
loadNotoKR("normal", {
  weights: ["400", "500", "700"],
  subsets: ["korean", "latin"],
  ignoreTooManyRequestsWarning: true,
});

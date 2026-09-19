import { Archivo, Bricolage_Grotesque, JetBrains_Mono, Source_Serif_4 } from "next/font/google";

// Landing headlines only. Variable, so no weight list is needed.
export const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Body and UI.
export const sans = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

// Accent line of every major headline, card titles and the wordmark.
// Italic is loaded because the accent line is always italic.
export const serif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// Figures, token ids, addresses, eyebrows and badges.
export const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

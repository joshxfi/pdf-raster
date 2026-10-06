import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pdf-raster.omsimos.com"),
  title: {
    default: "pdf-raster: PDF to PNG, JPEG and WebP for Node.js and Bun",
    template: "%s | pdf-raster",
  },
  description:
    "pdf-raster renders PDF pages to PNG, JPEG or WebP buffers with PDFium. One convert() call, Node.js 24+ and Bun, prebuilt for macOS, Linux and Windows.",
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}

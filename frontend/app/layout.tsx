import type { Metadata } from "next";
import "./globals.css";

// ---------------------------------------------------------------------------
// SEO Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "ReadAloud — Real-Time Guided Reading",
  description:
    "A real-time guided reading system that listens to you read, highlights words live, and provides deep grading reports. Powered by browser-native WASM speech recognition.",
  keywords: [
    "reading",
    "guided reading",
    "speech recognition",
    "STT",
    "education",
    "literacy",
  ],
};

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased selection:bg-blue-500/30"
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Story TTS Admin",
  description: "Professional Admin Panel for Story TTS API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-zinc-950 text-zinc-100 flex h-screen overflow-hidden selection:bg-blue-500/30">
        <Sidebar />
        <main className="flex-1 p-12 overflow-y-auto relative custom-scrollbar">
           <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] -z-10 rounded-full" />
           <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] -z-10 rounded-full" />
           <div className="max-w-7xl mx-auto">
              {children}
           </div>
        </main>
      </body>
    </html>
  );
}

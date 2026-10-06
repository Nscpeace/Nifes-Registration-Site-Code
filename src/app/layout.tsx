import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "NIFES UNIBEN | Building Tomorrow's Leaders Today", description: "Join the Nigeria Fellowship of Evangelical Students at the University of Benin.", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#06152f" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<script dangerouslySetInnerHTML={{ __html: `if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));` }} /></body></html>; }

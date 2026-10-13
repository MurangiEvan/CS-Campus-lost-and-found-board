import type { Metadata } from "next";
import Script from "next/script";
import { AuthSessionProvider } from "./auth-session-provider";
import "./globals.css";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "CampusLink | Lost & Found",
  description: "A trusted campus lost and found board.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="campuslink-theme" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('campuslink_theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`}
        </Script>
      </head>
      <body><AuthSessionProvider>{children}</AuthSessionProvider></body>
    </html>
  );
}

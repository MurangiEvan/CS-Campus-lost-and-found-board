import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusLink | Lost & Found",
  description: "A trusted campus lost and found board.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

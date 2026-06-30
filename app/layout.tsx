import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Antarang — A 3D Museum of World & Indian Art History",
  description:
    "Walk through the history of human civilisation in art. An interactive 3D museum where Indian art history stands as a first-class citizen alongside the rest of the world. Built on verified Wikipedia & Wikimedia Commons data.",
  keywords: [
    "art history",
    "Indian art",
    "3D museum",
    "Chola bronze",
    "Ajanta",
    "Van Gogh",
    "Wikimedia",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

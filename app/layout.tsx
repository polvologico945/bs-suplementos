import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BS Suplementos | Catálogo",
  description: "Catálogo digital da BS Suplementos em Baturité, Ceará.",
  icons: { icon: "/brand/logo-card.jpg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

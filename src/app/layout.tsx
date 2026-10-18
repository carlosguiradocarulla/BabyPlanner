import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BabyPlanner — tu embarazo, a tu ritmo",
  description: "Sigue tu embarazo y organiza tus preparativos en un espacio tranquilo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}

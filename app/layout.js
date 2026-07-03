import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "จำแนกงู — Thai Snake Identifier",
  description:
    "เครื่องมือช่วยจำแนกสายพันธุ์งูในไทยจากรูปถ่าย พร้อมบอกว่าเป็นงูมีพิษหรือไม่ เพื่อความปลอดภัย",
  icons: { icon: "/snakeIcoAI.ico" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

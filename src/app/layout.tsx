import type { Metadata } from "next";
import ScrollbarActivity from "./ScrollbarActivity";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hệ Thống Quản Trị Tài Sản",
  description: "Khoa Công nghệ Nhiệt lạnh — Trường Cao đẳng Nghề Cần Thơ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ScrollbarActivity />
        {children}
      </body>
    </html>
  );
}

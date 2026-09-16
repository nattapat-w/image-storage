import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans, Poppins } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const poppins = Poppins({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "image-storage",
  description: "Personal image drive with auth, folders, and sharing",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${notoSans.variable} ${poppins.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-[var(--bg-primary)]">
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          richColors
          toastOptions={{
            classNames: {
              toast: "bg-[var(--bg-floating)] border-[var(--border)] text-[var(--foreground)]",
            },
          }}
        />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Silkscreen } from "next/font/google";
import { Footer } from "@/components/footer";
import { SoundArm } from "@/components/sound-arm";
import { ThemeSync } from "@/components/theme-sync";
import { ToastProvider } from "@/components/ui/toast";
import { getThemeInitScript } from "@/lib/theme/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const arcade = Silkscreen({
  variable: "--font-arcade",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Bug Hunt Race",
  description: "Race your team to fix buggy code. Fastest correct fix wins.",
};

// "cover" lets the page reach the iPhone's rounded corners; globals.css pads
// the body and the fixed toasts by the safe-area insets instead.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${arcade.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
      </head>
      <body className="flex min-h-full flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] font-sans">
        <ThemeSync />
        <SoundArm />
        <ToastProvider>{children}</ToastProvider>
        <Footer />
      </body>
    </html>
  );
}

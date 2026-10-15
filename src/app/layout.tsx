import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { MotionProvider } from "@/components/motion-provider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "WorldForge — Build worlds that remember everything", template: "%s · WorldForge" },
  description:
    "Create living worlds where characters, kingdoms, history and lore evolve together. Explore connections, preserve your canon, and discover what changes when history takes another path.",
  applicationName: "WorldForge",
};

export const viewport: Viewport = {
  themeColor: "#101116",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg text-text">
        <MotionProvider>{children}</MotionProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: { background: "#1C1D24", border: "1px solid #30313A", color: "#F1EEE7" },
          }}
        />
      </body>
    </html>
  );
}

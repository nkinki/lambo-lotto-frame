import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
    title: "Lambo Lotto",
    description: "Buy a ticket, win the jackpot!",
    other: {
        "fc:frame": JSON.stringify({
            version: "next",
            imageUrl: "https://lambo-lotto-frame.vercel.app/og-image.png",
            button: {
                title: "Play Lambo Lotto",
                action: {
                    type: "launch_frame",
                    name: "Lambo Lotto",
                    url: "https://lambo-lotto-frame.vercel.app",
                    splashImageUrl: "https://lambo-lotto-frame.vercel.app/splash.png",
                    splashBackgroundColor: "#000000"
                }
            }
        })
    }
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="bg-black text-white">
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}

import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
    title: "Lambo Lotto",
    description: "Buy a ticket, win the jackpot!",
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

"use client"

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import LamboLottery from '@/components/LamboLottery';

// Force rebuild 2025-12-21
export default function Home() {
    const [isSDKLoaded, setIsSDKLoaded] = useState(false);
    const [context, setContext] = useState<any>();


    useEffect(() => {
        const load = async () => {
            setContext(await sdk.context);
            sdk.actions.ready();

            // Prompt user to add miniapp after SDK is ready
            const hasPrompted = localStorage.getItem('lambo-lotto-prompted');
            if (!hasPrompted) {
                setTimeout(async () => {
                    try {
                        await sdk.actions.addMiniApp();
                        localStorage.setItem('lambo-lotto-prompted', 'true');
                    } catch (error) {
                        console.log('User declined to add miniapp:', error);
                        localStorage.setItem('lambo-lotto-prompted', 'true');
                    }
                }, 2000); // Wait 2 seconds after SDK is ready
            }
        };
        if (sdk && !isSDKLoaded) {
            setIsSDKLoaded(true);
            load();
        }
    }, [isSDKLoaded]);

    // Use context FID if available, otherwise default to 0 (or handle login)
    const userFid = context?.user?.fid || 0;

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-0 bg-black">
            {/* We render LamboLottery directly. Since it's a modal in the original app, 
          we might need to adjust its styling if it expects to be an overlay. 
          But for now, passing isOpen={true} should work. */}
            <LamboLottery
                isOpen={true}
                onClose={() => { }}
                userFid={userFid}
                onPurchaseSuccess={() => console.log('Purchase success!')}
            />
        </main>
    );
}

"use client"

import { useEffect, useState } from 'react';
import sdk from '@farcaster/frame-sdk';
import LamboLottery from '@/components/LamboLottery';

export default function Home() {
    const [isSDKLoaded, setIsSDKLoaded] = useState(false);
    const [context, setContext] = useState<any>();


    useEffect(() => {
        const load = async () => {
            setContext(await sdk.context);
            sdk.actions.ready();
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

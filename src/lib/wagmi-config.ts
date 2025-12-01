import { createConfig, http } from "wagmi"
import { base } from "wagmi/chains"
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector"
import { injected, walletConnect } from "wagmi/connectors"

// A createConnectors segédfüggvény változatlan, mert az helyesen működik.
const createConnectors = () => {
  const connectors = []
  
  try {
    const farcasterConnector = miniAppConnector()
    if (farcasterConnector && typeof farcasterConnector === 'object') {
      connectors.push(farcasterConnector)
      console.log('✅ Farcaster MiniApp connector loaded successfully')
    }
  } catch (error) {
    console.warn('⚠️ Farcaster MiniApp connector failed to load:', error)
  }
  
  try {
    connectors.push(injected({
      shimDisconnect: true,
    }))
    console.log('✅ Injected connector loaded successfully')
  } catch (error) {
    console.warn('⚠️ Injected connector failed to load:', error)
  }
  
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
  if (projectId && projectId.trim() !== "") {
    try {
      connectors.push(walletConnect({
        projectId,
        metadata: {
          name: 'Farcaster MiniApp',
          description: 'Farcaster promotion campaigns',
          url: 'https://apprank.xyz',
          icons: ['https://apprank.xyz/icon.png']
        }
      }))
      console.log('✅ WalletConnect connector loaded successfully')
    } catch (error) {
      console.warn('⚠️ WalletConnect connector failed to load:', error)
    }
  }
  
  return connectors
}

// VISSZAÁLLÍTÁS: Újra a Base hálózat publikus RPC végpontját használjuk.
export const config = createConfig({
  chains: [base], 
  transports: {
    [base.id]: http(), // Ha nem adunk meg URL-t, a wagmi az alapértelmezett publikus RPC-t használja.
  },
  connectors: createConnectors(),
  ssr: false,
  syncConnectedChain: true,
})

// Export chain info for easy access
export const supportedChain = base
export const isValidChain = (chainId: number) => chainId === base.id
// FÁJL: src/abis/LottoPaymentRouter.ts
// CÉL: A lottó okosszerződés ABI-ját és a kapcsolódó konstansokat tartalmazza.

import { parseUnits } from 'viem';

// --- Okosszerződés ABI (Application Binary Interface) ---
// Ez a te Remix-ből másolt, teljes és helyes ABI-d.
export const LOTTO_PAYMENT_ROUTER_ABI = [
	{
		"inputs": [
			{ "internalType": "address", "name": "_chessTokenAddress", "type": "address" },
			{ "internalType": "address", "name": "_initialDestinationWallet", "type": "address" }
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [ { "internalType": "address", "name": "owner", "type": "address" } ],
		"name": "OwnableInvalidOwner",
		"type": "error"
	},
	{
		"inputs": [ { "internalType": "address", "name": "account", "type": "address" } ],
		"name": "OwnableUnauthorizedAccount",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [ { "indexed": true, "internalType": "address", "name": "newWallet", "type": "address" } ],
		"name": "DestinationWalletChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" },
			{ "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }
		],
		"name": "OwnershipTransferred",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "winner", "type": "address" },
			{ "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
		],
		"name": "PayoutMade",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "player", "type": "address" },
			{ "indexed": false, "internalType": "uint256", "name": "ticketNumber", "type": "uint256" }
		],
		"name": "TicketPurchased",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "MAX_TICKET_NUMBER",
		"outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "MIN_TICKET_NUMBER",
		"outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "TICKET_PRICE",
		"outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [ { "internalType": "uint256", "name": "_ticketNumber", "type": "uint256" } ],
		"name": "buyTicket",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "chessToken",
		"outputs": [ { "internalType": "contract IERC20", "name": "", "type": "address" } ],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "destinationWallet",
		"outputs": [ { "internalType": "address", "name": "", "type": "address" } ],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [ { "internalType": "address", "name": "", "type": "address" } ],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "_winner", "type": "address" },
			{ "internalType": "uint256", "name": "_amount", "type": "uint256" }
		],
		"name": "payout",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "renounceOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [ { "internalType": "address", "name": "_newWallet", "type": "address" } ],
		"name": "setDestinationWallet",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [ { "internalType": "address", "name": "newOwner", "type": "address" } ],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
] as const;


// --- Okosszerződés Címek ---
export const LOTTO_PAYMENT_ROUTER_ADDRESS = "0xdae08347a8a2d508d9f7a890b9997d771aab6d71";

// --- Szerződésből Származó Konstansok ---
// A jegy árát a CHESS token 18 tizedesjegyének megfelelően kell formázni.
export const TICKET_PRICE = parseUnits("100000", 18); // 100,000 CHESS
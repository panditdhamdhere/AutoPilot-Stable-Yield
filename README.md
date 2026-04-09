# AutoPilot Stable Yield

AutoPilot Stable Yield is a production-ready DeFi yield interface built for DeFi Mullet Hackathon #1 using LI.FI Earn + Composer.

It helps users discover top yield vaults, choose a risk profile, execute one-click deposits, and track portfolio positions in a polished, animated UI.

## Core Features

- Vault discovery via LI.FI Earn
- Strategy engine: `safe`, `balanced`, `aggressive`
- One-click deposit execution via LI.FI Composer quote flow
- Portfolio tracking via LI.FI Earn portfolio endpoint
- Testnet demo mode with separate demo portfolio counter
- Mobile quick deposit bottom sheet
- Built-in demo tour and onboarding flow

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- RainbowKit + Wagmi + Viem
- TanStack Query
- Framer Motion
- Recharts

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required values:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
LIFI_API_KEY=
LIFI_EARN_BASE_URL=https://earn.li.fi
LIFI_COMPOSER_BASE_URL=https://li.quest
LIFI_INTEGRATOR=defi-mullet-autopilot
NEXT_PUBLIC_ENABLE_TESTNET_MODE=false
```

Notes:

- Set `NEXT_PUBLIC_ENABLE_TESTNET_MODE=true` for demo-safe testnet behavior.
- Use `false` for real mainnet execution and portfolio updates.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production Build

```bash
npm run lint
npm run build
npm start
```

## API Routes

- `GET /api/earn/vaults` - Fetch and normalize LI.FI Earn vault data
- `POST /api/earn/quote` - Request LI.FI Composer quote for deposit execution
- `GET /api/earn/portfolio/[address]/positions` - Fetch normalized portfolio positions

## Demo Flow (Hackathon)

1. Connect wallet
2. Choose strategy profile
3. Enter amount and execute deposit
4. Show transaction confirmation and explorer link
5. Open portfolio section (or demo portfolio in testnet mode)

## Deployment

Recommended: Vercel

1. Push repository to GitHub
2. Import project into Vercel
3. Set all environment variables in Vercel project settings
4. Deploy

## Security Notes

- Never commit `.env` or secrets
- Use small amounts for mainnet verification transactions
- Validate wallet/network before transactions

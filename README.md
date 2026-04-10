# AutoPilot Stable Yield

**AutoPilot Stable Yield** is a Next.js dashboard for stable-yield vaults. It integrates [LI.FI Earn](https://docs.li.fi/earn/overview) for vault data and [LI.FI Composer](https://docs.li.fi/composer/overview) for deposit quotes. Wallets stay non-custodial: the app proposes allocations and routes; users sign in their own wallet.

**Live deployment:** [auto-pilot-stable-yield.vercel.app](https://auto-pilot-stable-yield.vercel.app/)

| Route | Purpose |
|-------|---------|
| `/` | Marketing landing |
| `/dashboard` | Main application |

---

## Overview

The app surfaces Earn vaults with filters (stable-focused assets and APY bands) so displayed yields stay in a realistic range. A lightweight **strategy layer** maps three profiles—`safe`, `balanced`, `aggressive`—to suggested allocations and shows a **risk score breakdown**. A **rebalance suggestion** appears when a low-weight vault trails a higher-APY alternative, with rationale in the UI.

**Deposits:** On mainnet-style configuration, deposits go through Composer quotes. With **testnet demo mode** enabled, the project uses a separate demo transaction path and mock-friendly behavior so Composer is not used for fake mainnet execution.

**Portfolio:** Positions come from the Earn portfolio API when mainnet-style mode is active. In testnet demo mode, the mainnet portfolio response is intentionally empty; a **demo portfolio** counter tracks demo transactions separately.

**Proof wall:** Transaction history includes explorer links, copyable proof text, JSON/CSV export, and `localStorage` persistence across reloads.

**Vault catalog:** Filterable table (chain, risk, asset), sortable columns, chain and token presentation.

**Other UI:** Dark/light theme, onboarding tour, optional **Ask AI** assistant backed by OpenAI when `OPENAI_API_KEY` is set.

---

## Tech stack

- Next.js (App Router), TypeScript, Tailwind CSS  
- RainbowKit, wagmi, viem  
- TanStack Query, Framer Motion, Recharts  

LI.FI and WalletConnect credentials are supplied via environment variables; server-side API routes proxy Earn and Composer so the `LIFI_API_KEY` is not exposed to the browser.

---

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

After configuring variables (see below), the app is available at `http://localhost:3000` (landing) and `http://localhost:3000/dashboard`.

```bash
npm run lint
npm run build
npm start
```

`npm start` runs the production build locally.

---

## Environment variables

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID for RainbowKit. |
| `LIFI_API_KEY` | [LI.FI API access](https://li.fi/plans/); sent as `x-lifi-api-key` on Earn and Composer proxies. |
| `LIFI_EARN_BASE_URL` | Earn API base URL (default `https://earn.li.fi`). |
| `LIFI_COMPOSER_BASE_URL` | Composer base URL (default `https://li.quest`). |
| `LIFI_INTEGRATOR` | Integrator identifier on quotes. |
| `NEXT_PUBLIC_ENABLE_TESTNET_MODE` | `true`: testnet chains, demo tx path, empty mainnet portfolio API body. `false`: mainnet Earn, Composer, and portfolio behavior. |
| `OPENAI_API_KEY` | Optional; enables `/api/chat` and the dashboard assistant. |
| `OPENAI_MODEL` | Optional; defaults to `gpt-4o-mini`. |

`.env` should not be committed. Hosted deployments (e.g. Vercel) expect the same keys in project environment settings.

---

## HTTP API (Next.js routes)

| Method & path | Behavior |
|---------------|----------|
| `GET /api/earn/vaults` | Proxies Earn; normalizes vaults for the UI. |
| `POST /api/earn/quote` | Composer quote for deposits; not used for mainnet execution in testnet demo mode. |
| `GET /api/earn/portfolio/[address]/positions` | Portfolio positions; empty response in testnet demo mode with an explanatory note. |
| `POST /api/chat` | Optional OpenAI proxy for the assistant. |

---

## Deployment

Typical setup on Vercel: connect the Git repository, select the Next.js preset, define production (and optionally preview) environment variables, then deploy. Production issues often trace to a missing `LIFI_API_KEY`, an invalid WalletConnect project ID, or `NEXT_PUBLIC_ENABLE_TESTNET_MODE` not matching the intended network behavior.

---

## Disclaimer

AutoPilot Stable Yield is experimental. Yields and protocol risk change over time; strategy and rebalance logic are heuristics, not financial advice. Anyone using mainnet should limit exposure to what they can afford to lose.

---

## License

No formal open-source license is bundled in this repository; treat the code as provided as-is unless a `LICENSE` file is added later.

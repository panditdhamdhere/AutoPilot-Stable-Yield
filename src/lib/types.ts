export type RiskLevel = "low" | "medium" | "high";

export type StrategyProfile = "safe" | "balanced" | "aggressive";

export interface Vault {
  id: string;
  name: string;
  protocol: string;
  chain: string;
  chainId: number;
  address: string;
  symbol: string;
  apy: number;
  tvlUsd: number;
  riskLevel: RiskLevel;
  withdrawalHours: number;
  isTransactional: boolean;
}

export interface StrategyAllocation {
  vaultId: string;
  allocationPct: number;
  expectedApy: number;
  reason: string;
}

export interface PortfolioPosition {
  chainId: number;
  protocolName: string;
  asset: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  };
  balanceUsd: number;
  balanceNative: string;
}

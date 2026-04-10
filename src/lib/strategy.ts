import type {
  RiskLevel,
  StrategyAllocation,
  StrategyProfile,
  Vault,
} from "@/lib/types";

const riskPenalty: Record<StrategyProfile, Record<RiskLevel, number>> = {
  safe: { low: 0, medium: 3, high: 6 },
  balanced: { low: 0, medium: 1.5, high: 3.5 },
  aggressive: { low: 0, medium: 0.5, high: 1.5 },
};

export interface RiskScoreBreakdown {
  finalScore: number;
  maxScore: number;
  factors: Array<{
    label: string;
    score: number;
    max: number;
    note: string;
  }>;
}

export function buildAllocations(
  vaults: Vault[],
  profile: StrategyProfile,
): StrategyAllocation[] {
  const scored = vaults
    .map((vault) => ({
      vault,
      score: vault.apy - riskPenalty[profile][vault.riskLevel],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const totalScore = scored.reduce((sum, item) => sum + Math.max(item.score, 0), 0) || 1;

  return scored.map(({ vault, score }) => {
    const weight = Math.max(score, 0) / totalScore;
    return {
      vaultId: vault.id,
      allocationPct: Number((weight * 100).toFixed(1)),
      expectedApy: vault.apy,
      reason: `${vault.protocol} on ${vault.chain} offers ${vault.apy.toFixed(1)}% APY with ${vault.riskLevel} risk.`,
    };
  });
}

export function blendedApy(
  allocations: StrategyAllocation[],
  vaults: Vault[],
): number {
  const vaultMap = new Map(vaults.map((vault) => [vault.id, vault]));
  const result = allocations.reduce((sum, allocation) => {
    const vault = vaultMap.get(allocation.vaultId);
    if (!vault) return sum;
    return sum + (allocation.allocationPct / 100) * vault.apy;
  }, 0);

  return Number(result.toFixed(2));
}

export function getRiskScoreBreakdown(
  vault: Vault | undefined,
  profile: StrategyProfile,
): RiskScoreBreakdown {
  if (!vault) {
    return {
      finalScore: 0,
      maxScore: 100,
      factors: [],
    };
  }

  const apyScore = Math.min(Math.round((vault.apy / 15) * 30), 30);
  const tvlScore = Math.min(Math.round((vault.tvlUsd / 200_000_000) * 25), 25);
  const liquidityScore = vault.withdrawalHours === 0 ? 20 : Math.max(4, 20 - vault.withdrawalHours);
  const baseRisk = vault.riskLevel === "low" ? 25 : vault.riskLevel === "medium" ? 15 : 8;
  const profileAdjustment =
    profile === "safe"
      ? vault.riskLevel === "high"
        ? -8
        : 2
      : profile === "balanced"
        ? 0
        : vault.riskLevel === "high"
          ? 4
          : -1;
  const riskFitScore = Math.max(0, Math.min(25, baseRisk + profileAdjustment));

  const factors = [
    {
      label: "Yield Potential",
      score: apyScore,
      max: 30,
      note: `${vault.apy.toFixed(1)}% APY`,
    },
    {
      label: "Liquidity Depth",
      score: tvlScore,
      max: 25,
      note: `$${Math.round(vault.tvlUsd).toLocaleString()} TVL`,
    },
    {
      label: "Exit Flexibility",
      score: liquidityScore,
      max: 20,
      note: vault.withdrawalHours === 0 ? "Instant exit" : `${vault.withdrawalHours}h withdrawal window`,
    },
    {
      label: "Profile Risk Fit",
      score: riskFitScore,
      max: 25,
      note: `${vault.riskLevel} risk for ${profile} mode`,
    },
  ];

  const finalScore = factors.reduce((sum, factor) => sum + factor.score, 0);
  return {
    finalScore,
    maxScore: 100,
    factors,
  };
}

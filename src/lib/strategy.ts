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

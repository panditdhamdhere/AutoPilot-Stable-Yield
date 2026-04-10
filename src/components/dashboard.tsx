"use client";

import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  BarChart3,
  Bot,
  ChevronLeft,
  ChevronRight,
  Send,
  Moon,
  Sun,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { parseUnits } from "viem";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";

import { mockVaults } from "@/lib/mock-vaults";
import { blendedApy, buildAllocations, getRiskScoreBreakdown } from "@/lib/strategy";
import type { PortfolioPosition, StrategyProfile, Vault } from "@/lib/types";
import { getInputTokenForVaultSymbol } from "@/lib/token-addresses";
import { isTestnetModeEnabled } from "@/lib/runtime-config";

const profileDescriptions: Record<StrategyProfile, string> = {
  safe: "Prioritizes low-risk vaults and strong liquidity.",
  balanced: "Balances yield and protocol/chain diversification.",
  aggressive: "Maximizes APY and accepts higher protocol risk.",
};

const chartColors = ["#22c55e", "#06b6d4", "#a855f7"];
const explorerByChainId: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  10: "https://optimistic.etherscan.io/tx/",
  8453: "https://basescan.org/tx/",
  42161: "https://arbiscan.io/tx/",
  137: "https://polygonscan.com/tx/",
  11155111: "https://sepolia.etherscan.io/tx/",
  84532: "https://sepolia.basescan.org/tx/",
  421614: "https://sepolia.arbiscan.io/tx/",
  11155420: "https://sepolia-optimism.etherscan.io/tx/",
  80002: "https://amoy.polygonscan.com/tx/",
};

const chainLogoMap: Record<string, string> = {
  Ethereum:
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/eth.png",
  Sepolia:
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/eth.png",
  Arbitrum:
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/arb.png",
  "Arbitrum Sepolia":
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/arb.png",
  Base:
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/base.png",
  "Base Sepolia":
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/base.png",
  Optimism:
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/op.png",
  "Optimism Sepolia":
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/op.png",
  Polygon:
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/matic.png",
  "Polygon Amoy":
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/matic.png",
  BSC: "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/bnb.png",
  Monad:
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/eth.png",
};

const tokenLogoMap: Record<string, string> = {
  ETH: "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/eth.png",
  USDC:
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/usdc.png",
  USDT:
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/usdt.png",
  DAI: "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/dai.png",
  USDE:
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/usde.png",
  USDS:
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/usds.png",
  SUSDE:
    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/usde.png",
};

function prettyUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function prettyTime(timestampMs: number | undefined): string {
  if (!timestampMs) return "N/A";
  return new Date(timestampMs).toLocaleTimeString();
}

function classNames(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function LogoBadge({
  label,
  logoUrl,
  size = 18,
}: {
  label: string;
  logoUrl?: string;
  size?: number;
}) {
  const fallback = label.slice(0, 2).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center overflow-hidden rounded-full bg-slate-700/30 text-[10px] font-bold text-white"
      style={{ width: size, height: size }}
      title={label}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${label} logo`}
          className="h-full w-full object-cover"
          onError={(event) => {
            const target = event.currentTarget;
            target.style.display = "none";
            const parent = target.parentElement;
            if (parent) parent.textContent = fallback;
          }}
        />
      ) : (
        fallback
      )}
    </span>
  );
}

interface ChartTooltipItem {
  name?: string;
  value?: number | string;
}

interface TxProofItem {
  hash: `0x${string}`;
  chainId: number;
  amount: string;
  vaultName: string;
  status: "confirmed" | "failed";
  timestamp: string;
}

interface TimelineStep {
  label: string;
  state: "idle" | "active" | "done" | "error";
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipItem[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-white/20 bg-slate-900/95 p-2 text-xs text-white">
      <p>{item?.name}</p>
      <p>{item?.value}% allocation</p>
    </div>
  );
}

const tourSteps = [
  {
    title: "1. Connect Wallet",
    description: "Use wallet connect to activate live vault and portfolio data.",
  },
  {
    title: "2. Choose Strategy",
    description: "Switch between safe, balanced, and aggressive allocations.",
  },
  {
    title: "3. Execute Deposit",
    description: "Enter amount and run one-click deposit or testnet demo tx.",
  },
  {
    title: "4. Verify Results",
    description: "Show transaction hash, confirmation, and portfolio updates.",
  },
] as const;

export function Dashboard({ vaults }: { vaults: Vault[] }) {
  const queryClient = useQueryClient();
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();

  const [profile, setProfile] = useState<StrategyProfile>("balanced");
  const [amount, setAmount] = useState("10");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string>("Idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isMobileDepositOpen, setIsMobileDepositOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [demoPortfolioUsd, setDemoPortfolioUsd] = useState(0);
  const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>([
    { label: "Route preparation", state: "idle" },
    { label: "Wallet signature", state: "idle" },
    { label: "Transaction submitted", state: "idle" },
    { label: "On-chain confirmation", state: "idle" },
  ]);
  const [proofWall, setProofWall] = useState<TxProofItem[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [copyProofStatus, setCopyProofStatus] = useState<"idle" | "copied" | "error">("idle");
  const [vaultChainFilter, setVaultChainFilter] = useState("all");
  const [vaultRiskFilter, setVaultRiskFilter] = useState("all");
  const [vaultAssetFilter, setVaultAssetFilter] = useState("all");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I can help with risk scoring, strategy selection, deposits, and rebalancing.",
    },
  ]);
  const isDark = theme === "dark";

  useEffect(() => {
    setIsMounted(true);
    const storedTheme = window.localStorage.getItem("autopilot-theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
    }
    const seenOnboarding = window.localStorage.getItem("autopilot-onboarding-seen");
    if (!seenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    window.localStorage.setItem("autopilot-theme", theme);
  }, [theme, isMounted]);

  const liveVaultsQuery = useQuery({
    queryKey: ["earn-vaults"],
    queryFn: async (): Promise<Vault[]> => {
      const response = await fetch("/api/earn/vaults", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load vaults");
      const json = (await response.json()) as { data?: Vault[] };
      return json.data ?? [];
    },
    refetchInterval: 180_000,
  });

  const portfolioQuery = useQuery({
    queryKey: ["portfolio-positions", address],
    enabled: Boolean(address),
    queryFn: async (): Promise<{ positions: PortfolioPosition[]; totalUsd: number }> => {
      const response = await fetch(`/api/earn/portfolio/${address}/positions`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const errorPayload = (await response.json()) as { error?: string };
        throw new Error(errorPayload.error ?? "Failed to fetch portfolio positions");
      }
      return (await response.json()) as { positions: PortfolioPosition[]; totalUsd: number };
    },
    refetchInterval: 120_000,
  });

  const activeVaults = liveVaultsQuery.data?.length ? liveVaultsQuery.data : vaults.length ? vaults : mockVaults;
  const isLiveVaultData = Boolean(liveVaultsQuery.data?.length);
  const dataHealthLabel = liveVaultsQuery.isError ? "API Error" : isLiveVaultData ? "Live" : "Fallback";
  const lastUpdatedLabel = prettyTime(liveVaultsQuery.dataUpdatedAt);
  const allocations = useMemo(() => buildAllocations(activeVaults, profile), [activeVaults, profile]);
  const apy = useMemo(() => blendedApy(allocations, activeVaults), [allocations, activeVaults]);
  const bestAllocation = allocations[0];
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const defaultVaultId = bestAllocation?.vaultId ?? activeVaults[0]?.id ?? null;
  const selectedVault = activeVaults.find((item) => item.id === (selectedVaultId ?? defaultVaultId));

  useEffect(() => {
    if (!defaultVaultId) return;
    if (!selectedVaultId) {
      setSelectedVaultId(defaultVaultId);
      return;
    }
    const exists = activeVaults.some((vault) => vault.id === selectedVaultId);
    if (!exists) {
      setSelectedVaultId(defaultVaultId);
    }
  }, [activeVaults, defaultVaultId, selectedVaultId]);

  const chartData = allocations.map((item) => {
    const vault = activeVaults.find((v) => v.id === item.vaultId);
    return {
      name: `${vault?.protocol ?? "Vault"} (${vault?.chain ?? "N/A"})`,
      value: item.allocationPct,
    };
  });
  const riskBreakdown = getRiskScoreBreakdown(selectedVault, profile);
  const uniqueChains = Array.from(new Set(activeVaults.map((vault) => vault.chain))).sort();
  const uniqueAssets = Array.from(new Set(activeVaults.map((vault) => vault.symbol))).sort();
  const filteredVaultCatalog = activeVaults.filter((vault) => {
    const chainOk = vaultChainFilter === "all" || vault.chain === vaultChainFilter;
    const riskOk = vaultRiskFilter === "all" || vault.riskLevel === vaultRiskFilter;
    const assetOk = vaultAssetFilter === "all" || vault.symbol === vaultAssetFilter;
    return chainOk && riskOk && assetOk;
  });
  const highestApyVault = activeVaults.reduce((best, current) =>
    current.apy > best.apy ? current : best,
  selectedVault ?? activeVaults[0]);
  const lowestAllocation = [...allocations].sort((a, b) => a.allocationPct - b.allocationPct)[0];
  const rebalanceFromVault = selectedVault ?? activeVaults.find((vault) => vault.id === lowestAllocation?.vaultId);
  const rebalanceToVault = highestApyVault;
  const apyDelta = rebalanceFromVault && rebalanceToVault
    ? Number((rebalanceToVault.apy - rebalanceFromVault.apy).toFixed(2))
    : 0;
  const suggestedMovePct = lowestAllocation ? Math.min(15, Math.round(lowestAllocation.allocationPct / 2)) : 0;

  async function handleDeposit() {
    setActionError(null);
    setTxHash(null);
    setTimelineSteps([
      { label: "Route preparation", state: "active" },
      { label: "Wallet signature", state: "idle" },
      { label: "Transaction submitted", state: "idle" },
      { label: "On-chain confirmation", state: "idle" },
    ]);
    if (!walletClient || !publicClient || !address) {
      setActionError("Connect your wallet first.");
      return;
    }
    if (!selectedVault) {
      setActionError("No vault selected.");
      return;
    }
    if (!Number(amount) || Number(amount) <= 0) {
      setActionError("Enter a valid amount.");
      return;
    }

    try {
      setIsSubmitting(true);
      setTxStatus("Preparing route...");
      const expectedChainId = selectedVault.chainId;
      if (chainId !== expectedChainId) {
        setTxStatus(`Switching network to ${selectedVault.chain}...`);
        await switchChainAsync({ chainId: expectedChainId });
      }

      let hash: `0x${string}`;
      if (isTestnetModeEnabled) {
        setTimelineSteps([
          { label: "Route preparation", state: "done" },
          { label: "Wallet signature", state: "active" },
          { label: "Transaction submitted", state: "idle" },
          { label: "On-chain confirmation", state: "idle" },
        ]);
        setTxStatus("Testnet demo mode: sending a zero-value proof transaction...");
        hash = await walletClient.sendTransaction({
          account: address,
          to: address,
          value: BigInt(0),
        });
      } else {
        const fromToken = getInputTokenForVaultSymbol(selectedVault.chainId, selectedVault.symbol);
        const fromAmount = parseUnits(amount, 6).toString();
        const quoteResponse = await fetch("/api/earn/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromChain: selectedVault.chainId,
            toChain: selectedVault.chainId,
            fromToken,
            toToken: selectedVault.address,
            fromAmount,
            fromAddress: address,
            toAddress: address,
          }),
        });

        const quote = (await quoteResponse.json()) as {
          transactionRequest?: {
            to: `0x${string}`;
            data: `0x${string}`;
            value?: string;
            gasLimit?: string;
            gasPrice?: string;
          };
          error?: string;
          details?: string;
        };

        if (!quoteResponse.ok || !quote.transactionRequest) {
          throw new Error(quote.details ?? quote.error ?? "Quote unavailable");
        }

        setTimelineSteps([
          { label: "Route preparation", state: "done" },
          { label: "Wallet signature", state: "active" },
          { label: "Transaction submitted", state: "idle" },
          { label: "On-chain confirmation", state: "idle" },
        ]);
        setTxStatus("Waiting for wallet signature...");
        hash = await walletClient.sendTransaction({
          account: address,
          to: quote.transactionRequest.to,
          data: quote.transactionRequest.data,
          value: quote.transactionRequest.value
            ? BigInt(quote.transactionRequest.value)
            : undefined,
          gas: quote.transactionRequest.gasLimit
            ? BigInt(quote.transactionRequest.gasLimit)
            : undefined,
          gasPrice: quote.transactionRequest.gasPrice
            ? BigInt(quote.transactionRequest.gasPrice)
            : undefined,
        });
      }

      setTxHash(hash);
      setTimelineSteps([
        { label: "Route preparation", state: "done" },
        { label: "Wallet signature", state: "done" },
        { label: "Transaction submitted", state: "active" },
        { label: "On-chain confirmation", state: "idle" },
      ]);
      setTxStatus("Transaction sent. Confirming...");
      await publicClient.waitForTransactionReceipt({ hash });
      setTxStatus(
        isTestnetModeEnabled ? "Testnet demo transaction confirmed." : "Deposit confirmed on-chain.",
      );
      setTimelineSteps([
        { label: "Route preparation", state: "done" },
        { label: "Wallet signature", state: "done" },
        { label: "Transaction submitted", state: "done" },
        { label: "On-chain confirmation", state: "done" },
      ]);
      if (isTestnetModeEnabled) {
        setDemoPortfolioUsd((current) => Number((current + Number(amount)).toFixed(2)));
      }
      setProofWall((current) => [
        {
          hash,
          chainId: selectedVault.chainId,
          amount,
          vaultName: selectedVault.name,
          status: "confirmed" as const,
          timestamp: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 5));
      setIsMobileDepositOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["portfolio-positions", address] });
    } catch (error) {
      setTxStatus("Failed");
      setActionError(error instanceof Error ? error.message : "Failed to execute deposit");
      setTimelineSteps((current) =>
        current.map((step) =>
          step.state === "active" ? { ...step, state: "error" } : step,
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendChat() {
    const message = chatInput.trim();
    if (!message || isChatLoading) return;
    setChatInput("");

    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", content: message }];
    setChatMessages(nextMessages);
    setIsChatLoading(true);

    try {
      const chatContext = {
        mode: isTestnetModeEnabled ? "testnet" : "mainnet",
        strategyProfile: profile,
        expectedApy: apy,
        selectedVault: selectedVault
          ? {
              name: selectedVault.name,
              protocol: selectedVault.protocol,
              chain: selectedVault.chain,
              apy: selectedVault.apy,
              riskLevel: selectedVault.riskLevel,
            }
          : undefined,
        riskScore:
          riskBreakdown.maxScore > 0
            ? { value: riskBreakdown.finalScore, max: riskBreakdown.maxScore }
            : undefined,
        rebalanceSuggestion:
          rebalanceFromVault && rebalanceToVault && apyDelta > 0
            ? {
                fromProtocol: rebalanceFromVault.protocol,
                toProtocol: rebalanceToVault.protocol,
                apyDelta,
                movePct: suggestedMovePct,
              }
            : undefined,
        txStatus,
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-10),
          context: chatContext,
        }),
      });
      const json = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !json.answer) {
        throw new Error(json.error ?? "Chat request failed");
      }
      setChatMessages((current) => [...current, { role: "assistant", content: json.answer! }]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? `Assistant unavailable: ${error.message}`
              : "Assistant unavailable right now.",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  }

  async function handleCopyDemoProof() {
    const latest = proofWall[0];
    if (!latest) return;
    const explorer = `${explorerByChainId[latest.chainId] ?? "https://etherscan.io/tx/"}${latest.hash}`;
    const proofText = [
      "AutoPilot Stable Yield - Demo Proof",
      `Mode: ${isTestnetModeEnabled ? "Testnet Demo" : "Mainnet Live"}`,
      `Vault: ${latest.vaultName}`,
      `Amount: ${latest.amount}`,
      `Status: ${latest.status}`,
      `Time: ${new Date(latest.timestamp).toISOString()}`,
      `Tx Hash: ${latest.hash}`,
      `Explorer: ${explorer}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(proofText);
      setCopyProofStatus("copied");
      window.setTimeout(() => setCopyProofStatus("idle"), 1800);
    } catch {
      setCopyProofStatus("error");
      window.setTimeout(() => setCopyProofStatus("idle"), 1800);
    }
  }

  return (
    <main
      className={classNames(
        "relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 overflow-hidden px-4 py-8 transition-colors duration-500 md:px-8",
        isDark ? "bg-slate-950 text-white" : "bg-transparent text-slate-900",
      )}
    >
      <motion.div
        className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-cyan-400/30 blur-3xl"
        animate={{ x: [0, 60, 0], y: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity }}
      />
      <motion.div
        className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-violet-400/30 blur-3xl"
        animate={{ x: [0, -40, 0], y: [0, -10, 0] }}
        transition={{ duration: 14, repeat: Infinity }}
      />

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={classNames(
          "relative overflow-hidden rounded-3xl border p-7 shadow-2xl transition-colors duration-500",
          theme === "dark"
            ? "border-white/10 bg-linear-to-br from-slate-900 via-indigo-950 to-black text-white"
            : "border-white/20 bg-linear-to-br from-slate-900 via-indigo-900 to-slate-900 text-white",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">AutoPilot Stable Yield</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-200 md:text-base">
              AI-style strategy allocation, one-click execution, and live position tracking powered by LI.FI.
            </p>
            {isTestnetModeEnabled ? (
              <p className="mt-4 inline-flex rounded-full border border-amber-300/40 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100">
                Testnet Demo Mode
              </p>
            ) : (
              <p className="mt-4 inline-flex rounded-full border border-emerald-300/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                Mainnet Live Mode
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={classNames(
                  "inline-flex rounded-full border px-3 py-1 font-semibold",
                  dataHealthLabel === "Live"
                    ? "border-emerald-300/40 bg-emerald-500/20 text-emerald-100"
                    : dataHealthLabel === "Fallback"
                      ? "border-amber-300/40 bg-amber-500/20 text-amber-100"
                      : "border-red-300/40 bg-red-500/20 text-red-100",
                )}
              >
                Data: {dataHealthLabel}
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-medium text-slate-100">
                Last updated: {lastUpdatedLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTourStepIndex(0);
                setIsTourOpen(true);
              }}
              className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Start Demo Tour
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-2xl border border-white/20 bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-2 backdrop-blur">
              <ConnectButton showBalance={false} />
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Expected APY",
            value: `${apy}%`,
            icon: <TrendingUp size={16} />,
          },
          {
            title: "Supported Vaults",
            value: String(activeVaults.length),
            icon: <Wallet size={16} />,
          },
          {
            title: "Strategy Profile",
            value: profile,
            icon: <ShieldCheck size={16} />,
          },
        ].map((metric, index) => (
          <motion.article
            key={metric.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            whileHover={{ y: -4, scale: 1.01 }}
            className={classNames(
              "rounded-2xl border p-5 shadow-lg backdrop-blur-md transition-colors duration-500",
              theme === "dark"
                ? "border-white/10 bg-white/5"
                : "border-white/60 bg-white/70",
            )}
          >
            <p
              className={classNames(
                "inline-flex items-center gap-2 text-xs font-semibold uppercase",
                isDark ? "text-slate-200" : "text-slate-500",
              )}
            >
              {metric.icon} {metric.title}
            </p>
            <p className={classNames("mt-3 text-3xl font-bold capitalize", isDark ? "text-white" : "text-slate-900")}>
              {metric.value}
            </p>
          </motion.article>
        ))}
      </section>

      <section
        className={classNames(
          "rounded-3xl border p-5 shadow-xl backdrop-blur-md transition-colors duration-500",
          isDark ? "border-white/10 bg-white/5" : "border-white/60 bg-white/75",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className={classNames("text-lg font-semibold", isDark ? "text-white" : "text-slate-900")}>
            Supported Vault Catalog
          </h2>
          <p className={classNames("text-sm", isDark ? "text-slate-200" : "text-slate-600")}>
            {activeVaults.length} vaults
          </p>
        </div>
        <p className={classNames("mt-1 text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
          Real-time vaults currently available for strategy selection and deposit routing.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
          <select
            value={vaultChainFilter}
            onChange={(event) => setVaultChainFilter(event.target.value)}
            className={classNames(
              "rounded-xl border px-3 py-2 text-sm",
              isDark ? "border-white/20 bg-white/10 text-white" : "border-slate-300 bg-white text-slate-900",
            )}
          >
            <option value="all">All Chains</option>
            {uniqueChains.map((chain) => (
              <option key={chain} value={chain}>
                {chain}
              </option>
            ))}
          </select>
          <select
            value={vaultRiskFilter}
            onChange={(event) => setVaultRiskFilter(event.target.value)}
            className={classNames(
              "rounded-xl border px-3 py-2 text-sm",
              isDark ? "border-white/20 bg-white/10 text-white" : "border-slate-300 bg-white text-slate-900",
            )}
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select
            value={vaultAssetFilter}
            onChange={(event) => setVaultAssetFilter(event.target.value)}
            className={classNames(
              "rounded-xl border px-3 py-2 text-sm",
              isDark ? "border-white/20 bg-white/10 text-white" : "border-slate-300 bg-white text-slate-900",
            )}
          >
            <option value="all">All Assets</option>
            {uniqueAssets.map((asset) => (
              <option key={asset} value={asset}>
                {asset}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setVaultChainFilter("all");
              setVaultRiskFilter("all");
              setVaultAssetFilter("all");
            }}
            className="rounded-xl bg-linear-to-r from-indigo-600 to-cyan-500 px-3 py-2 text-sm font-semibold text-white"
          >
            Reset
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr>
                {["Vault", "Protocol", "Chain", "Asset", "APY", "TVL", "Risk"].map((header) => (
                  <th
                    key={header}
                    className={classNames(
                      "px-3 text-left text-xs font-semibold uppercase",
                      isDark ? "text-slate-300" : "text-slate-500",
                    )}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredVaultCatalog.map((vault) => (
                <tr
                  key={vault.id}
                  className={classNames(
                    "rounded-xl",
                    isDark ? "bg-slate-900/40" : "bg-white",
                  )}
                >
                  <td className={classNames("rounded-l-xl px-3 py-2 text-sm font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    {vault.name}
                  </td>
                  <td className={classNames("px-3 py-2 text-sm", isDark ? "text-slate-200" : "text-slate-700")}>
                    {vault.protocol}
                  </td>
                  <td className={classNames("px-3 py-2 text-sm", isDark ? "text-slate-200" : "text-slate-700")}>
                    <span className="inline-flex items-center gap-2">
                      <LogoBadge label={vault.chain} logoUrl={chainLogoMap[vault.chain]} />
                      {vault.chain}
                    </span>
                  </td>
                  <td className={classNames("px-3 py-2 text-sm", isDark ? "text-slate-200" : "text-slate-700")}>
                    <span className="inline-flex items-center gap-2">
                      <LogoBadge
                        label={vault.symbol}
                        logoUrl={tokenLogoMap[vault.symbol.toUpperCase()]}
                      />
                      {vault.symbol}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm font-semibold text-emerald-500">{vault.apy.toFixed(2)}%</td>
                  <td className={classNames("px-3 py-2 text-sm", isDark ? "text-slate-200" : "text-slate-700")}>
                    {prettyUsd(vault.tvlUsd)}
                  </td>
                  <td className="rounded-r-xl px-3 py-2">
                    <span
                      className={classNames(
                        "rounded-full px-2 py-1 text-xs font-semibold",
                        vault.riskLevel === "low"
                          ? "bg-emerald-100 text-emerald-700"
                          : vault.riskLevel === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700",
                      )}
                    >
                      {vault.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredVaultCatalog.length === 0 ? (
            <p className={classNames("mt-2 text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
              No vaults match the selected filters.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <motion.article
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={classNames(
            "rounded-3xl border p-5 shadow-xl backdrop-blur-md transition-colors duration-500",
            theme === "dark" ? "border-white/10 bg-white/5" : "border-white/60 bg-white/75",
          )}
        >
          <h2 className={classNames("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>
            Strategy Engine
          </h2>
          <p className={classNames("mt-1 text-sm", isDark ? "text-slate-200" : "text-slate-600")}>
            {profileDescriptions[profile]}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["safe", "balanced", "aggressive"] as const).map((item) => (
              <motion.button
                key={item}
                type="button"
                onClick={() => setProfile(item)}
                whileTap={{ scale: 0.96 }}
                className={classNames(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  profile === item
                    ? "bg-linear-to-r from-indigo-600 to-cyan-500 text-white shadow"
                    : isDark
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                {item}
              </motion.button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            <div
              className={classNames(
                "rounded-2xl border p-4",
                isDark ? "border-cyan-400/20 bg-cyan-500/10" : "border-cyan-200 bg-cyan-50/70",
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className={classNames("text-sm font-bold", isDark ? "text-cyan-100" : "text-cyan-900")}>
                  Risk Score Breakdown
                </p>
                <p className={classNames("text-sm font-semibold", isDark ? "text-cyan-100" : "text-cyan-900")}>
                  {riskBreakdown.finalScore}/{riskBreakdown.maxScore}
                </p>
              </div>
              <div className="space-y-2">
                {riskBreakdown.factors.map((factor) => {
                  const pct = Math.round((factor.score / factor.max) * 100);
                  return (
                    <div key={factor.label}>
                      <div className="flex items-center justify-between text-xs">
                        <p className={classNames("font-medium", isDark ? "text-slate-100" : "text-slate-800")}>
                          {factor.label}
                        </p>
                        <p className={classNames(isDark ? "text-slate-200" : "text-slate-700")}>
                          {factor.score}/{factor.max}
                        </p>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-300/40">
                        <div
                          className="h-1.5 rounded-full bg-linear-to-r from-indigo-500 to-cyan-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className={classNames("mt-1 text-[11px]", isDark ? "text-slate-300" : "text-slate-600")}>
                        {factor.note}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            <AnimatePresence mode="popLayout">
              {allocations.map((allocation, index) => {
                const vault = activeVaults.find((item) => item.id === allocation.vaultId);
                if (!vault) return null;
                return (
                  <motion.div
                    key={allocation.vaultId}
                    layout
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.25 }}
                    className={classNames(
                      "rounded-2xl border p-4 shadow-sm transition-colors duration-500",
                      theme === "dark" ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-white",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={classNames("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                        {index + 1}. {vault.protocol} - {vault.chain}
                      </p>
                      <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                        {allocation.allocationPct}%
                      </span>
                    </div>
                    <p className={classNames("mt-1 text-sm", isDark ? "text-slate-200" : "text-slate-600")}>
                      APY {vault.apy}% | TVL {prettyUsd(vault.tvlUsd)} | Risk {vault.riskLevel}
                    </p>
                    <p className={classNames("mt-1 text-xs", isDark ? "text-slate-300" : "text-slate-500")}>
                      {allocation.reason}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className={classNames(
            "rounded-3xl border p-5 shadow-xl backdrop-blur-md transition-colors duration-500",
            theme === "dark" ? "border-white/10 bg-white/5" : "border-white/60 bg-white/75",
          )}
        >
          <h2 className={classNames("inline-flex items-center gap-2 text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>
            <BarChart3 size={18} /> Allocation Mix
          </h2>
          <div className="mt-4 h-64 w-full">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    label={({ value }) => `${value}%`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : null}
          </div>
          <div
            className={classNames(
              "mt-4 space-y-2 rounded-2xl border p-4 shadow-sm transition-colors duration-500",
              theme === "dark" ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-white",
            )}
          >
            <p className={classNames("text-xs font-semibold uppercase tracking-wide", isDark ? "text-slate-200" : "text-slate-500")}>
              Live Deposit
            </p>
            <p className={classNames("text-xs", isDark ? "text-slate-200" : "text-slate-600")}>
              <span className="inline-flex items-center gap-1">
                Target: {selectedVault?.name ?? "N/A"}
                {selectedVault ? (
                  <>
                    <LogoBadge
                      label={selectedVault.chain}
                      logoUrl={chainLogoMap[selectedVault.chain]}
                      size={14}
                    />
                    <span>({selectedVault.chain})</span>
                  </>
                ) : null}
              </span>
            </p>
            <select
              value={selectedVault?.id ?? ""}
              onChange={(event) => setSelectedVaultId(event.target.value)}
              className={classNames(
                "w-full rounded-xl border px-3 py-2 text-sm outline-none transition",
                isDark
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-slate-300 bg-white text-slate-900",
              )}
            >
              {activeVaults.map((vault) => (
                <option key={vault.id} value={vault.id}>
                  {vault.protocol} - {vault.chain} ({vault.apy.toFixed(1)}% APY)
                </option>
              ))}
            </select>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              className={classNames(
                "w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]",
                isDark
                  ? "border-white/20 bg-white/10 text-white placeholder:text-slate-300"
                  : "border-slate-300 text-slate-900",
              )}
              placeholder="Amount (USDC)"
            />
            <div className="flex gap-2">
              {["10", "50", "100"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className={classNames(
                    "rounded-lg px-3 py-1 text-xs font-semibold transition",
                    amount === preset
                      ? "bg-linear-to-r from-indigo-600 to-cyan-500 text-white"
                      : isDark
                        ? "bg-white/10 text-slate-100 hover:bg-white/20"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  )}
                >
                  {preset} USDC
                </button>
              ))}
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDeposit}
              disabled={isSubmitting || !selectedVault}
              className="w-full rounded-xl bg-linear-to-r from-indigo-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Processing..." : isTestnetModeEnabled ? "Send Testnet Demo Tx" : "One-Click Deposit"}
            </motion.button>
            <p className={classNames("text-xs", isDark ? "text-slate-200" : "text-slate-500")}>
              Status: {txStatus}
            </p>
            <div className="mt-1 space-y-1.5">
              {timelineSteps.map((step) => (
                <div key={step.label} className="flex items-center gap-2 text-xs">
                  <span
                    className={classNames(
                      "inline-block h-2 w-2 rounded-full",
                      step.state === "done"
                        ? "bg-emerald-400"
                        : step.state === "active"
                          ? "bg-cyan-400"
                          : step.state === "error"
                            ? "bg-red-500"
                            : "bg-slate-400/50",
                    )}
                  />
                  <span
                    className={classNames(
                      isDark ? "text-slate-200" : "text-slate-600",
                      step.state === "active" && "font-semibold",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
            {txHash ? (
              <a
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"
                href={`${explorerByChainId[selectedVault?.chainId ?? 1] ?? "https://etherscan.io/tx/"}${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View tx: {txHash.slice(0, 10)}... <ArrowUpRight size={12} />
              </a>
            ) : null}
            {actionError ? <p className="text-xs font-medium text-red-600">{actionError}</p> : null}
          </div>
          <div
            className={classNames(
              "mt-3 rounded-2xl border p-4 transition-colors duration-500",
              isDark ? "border-emerald-300/20 bg-emerald-500/10" : "border-emerald-200 bg-emerald-50",
            )}
          >
            <p className={classNames("text-xs font-semibold uppercase tracking-wide", isDark ? "text-emerald-200" : "text-emerald-800")}>
              Rebalance Recommendation
            </p>
            {rebalanceFromVault && rebalanceToVault && apyDelta > 0 ? (
              <>
                <p className={classNames("mt-1 text-sm font-semibold", isDark ? "text-white" : "text-slate-900")}>
                  Move ~{suggestedMovePct}% from {rebalanceFromVault.protocol} to {rebalanceToVault.protocol}
                </p>
                <p className={classNames("mt-1 text-xs", isDark ? "text-emerald-100" : "text-emerald-700")}>
                  Potential APY uplift: +{apyDelta}% (from {rebalanceFromVault.apy.toFixed(1)}% to{" "}
                  {rebalanceToVault.apy.toFixed(1)}%).
                </p>
                <p className={classNames("mt-1 text-xs", isDark ? "text-slate-200" : "text-slate-600")}>
                  Why: your current lowest-weight vault has lower yield than the top available vault for this strategy.
                </p>
              </>
            ) : (
              <p className={classNames("mt-1 text-xs", isDark ? "text-emerald-100" : "text-emerald-700")}>
                Portfolio allocation is already near-optimal for this profile right now.
              </p>
            )}
          </div>
        </motion.article>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className={classNames(
          "rounded-3xl border p-5 shadow-xl backdrop-blur-md transition-colors duration-500",
          theme === "dark" ? "border-white/10 bg-white/5" : "border-white/60 bg-white/75",
        )}
      >
        <h2 className={classNames("text-lg font-semibold", isDark ? "text-white" : "text-slate-900")}>
          Portfolio Tracking
        </h2>
        {!address ? (
          <p className={classNames("mt-2 text-sm", isDark ? "text-slate-200" : "text-slate-600")}>
            Connect your wallet to load LI.FI Earn portfolio positions.
          </p>
        ) : portfolioQuery.isLoading ? (
          <p className={classNames("mt-2 text-sm", isDark ? "text-slate-200" : "text-slate-600")}>
            Loading positions...
          </p>
        ) : portfolioQuery.error ? (
          <p className="mt-2 text-sm text-red-600">
            {portfolioQuery.error instanceof Error ? portfolioQuery.error.message : "Failed to load positions"}
          </p>
        ) : (
          <>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <p
                  className={classNames(
                    "text-xs font-medium uppercase",
                    isDark ? "text-slate-200" : "text-slate-500",
                  )}
                >
                  {isTestnetModeEnabled ? "Mainnet Portfolio Value" : "Total Portfolio Value"}
                </p>
                <p className={classNames("mt-1 text-2xl font-semibold", isDark ? "text-white" : "text-slate-900")}>
                  {prettyUsd(portfolioQuery.data?.totalUsd ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className={classNames("text-xs font-medium uppercase", isDark ? "text-slate-200" : "text-slate-500")}>
                  Active Positions
                </p>
                <p className={classNames("mt-1 text-2xl font-semibold", isDark ? "text-white" : "text-slate-900")}>
                  {portfolioQuery.data?.positions.length ?? 0}
                </p>
              </div>
            </div>
            {isTestnetModeEnabled ? (
              <div className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4">
                <p
                  className={classNames(
                    "text-xs font-semibold uppercase tracking-wide",
                    isDark ? "text-cyan-200" : "text-cyan-700",
                  )}
                >
                  Demo Portfolio (Testnet Only)
                </p>
                <p className={classNames("mt-1 text-2xl font-bold", isDark ? "text-white" : "text-slate-900")}>
                  {prettyUsd(demoPortfolioUsd)}
                </p>
                <p className={classNames("mt-1 text-xs", isDark ? "text-cyan-100" : "text-cyan-700")}>
                  Increases when demo transactions confirm. This is separate from real LI.FI mainnet positions.
                </p>
              </div>
            ) : null}
            <div className="mt-4 space-y-2">
              {(portfolioQuery.data?.positions ?? []).slice(0, 8).map((position, index) => (
                <div
                  key={`${position.protocolName}-${position.asset.address}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
                >
                  <div>
                    <p className={classNames("text-sm font-semibold", isDark ? "text-white" : "text-slate-900")}>
                      {position.asset.symbol} on {position.protocolName}
                    </p>
                    <p className={classNames("text-xs", isDark ? "text-slate-200" : "text-slate-500")}>
                      Chain ID: {position.chainId}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700">
                    {prettyUsd(position.balanceUsd)}
                  </p>
                </div>
              ))}
              {(portfolioQuery.data?.positions.length ?? 0) === 0 ? (
                <p className={classNames("text-sm", isDark ? "text-slate-200" : "text-slate-600")}>
                  {isTestnetModeEnabled
                    ? "Testnet mode uses demo transactions; no real Earn positions are expected."
                    : "No positions detected yet. After your first deposit confirms, refresh in ~10-30 seconds."}
                </p>
              ) : null}
            </div>
          </>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={classNames(
          "rounded-3xl border p-5 shadow-xl backdrop-blur-md transition-colors duration-500",
          isDark ? "border-white/10 bg-white/5" : "border-white/60 bg-white/75",
        )}
      >
        <h2 className={classNames("text-lg font-semibold", isDark ? "text-white" : "text-slate-900")}>
          Transaction Proof Wall
        </h2>
        <p className={classNames("mt-1 text-sm", isDark ? "text-slate-200" : "text-slate-600")}>
          Latest confirmed transactions and execution proof for your session.
        </p>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void handleCopyDemoProof()}
            disabled={proofWall.length === 0}
            className="rounded-xl bg-linear-to-r from-indigo-600 to-cyan-500 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copyProofStatus === "copied"
              ? "Copied!"
              : copyProofStatus === "error"
                ? "Copy Failed"
                : "Copy Demo Proof"}
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {proofWall.length === 0 ? (
            <p className={classNames("text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
              No transaction proofs yet. Execute a deposit to populate this wall.
            </p>
          ) : (
            proofWall.map((item) => (
              <div
                key={`${item.hash}-${item.timestamp}`}
                className={classNames(
                  "flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3",
                  isDark ? "border-white/10 bg-slate-900/40" : "border-slate-200 bg-white",
                )}
              >
                <div>
                  <p className={classNames("text-sm font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    {item.vaultName}
                  </p>
                  <p className={classNames("text-xs", isDark ? "text-slate-300" : "text-slate-600")}>
                    Amount: {item.amount} | {new Date(item.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={classNames("text-xs font-semibold", item.status === "confirmed" ? "text-emerald-500" : "text-red-500")}>
                    {item.status.toUpperCase()}
                  </p>
                  <a
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"
                    href={`${explorerByChainId[item.chainId] ?? "https://etherscan.io/tx/"}${item.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.hash.slice(0, 12)}... <ArrowUpRight size={12} />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.section>

      <div className="fixed right-4 bottom-4 z-30 md:hidden">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setIsMobileDepositOpen(true)}
          className="rounded-full bg-linear-to-r from-indigo-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-xl"
        >
          Quick Deposit
        </motion.button>
      </div>

      <div className="fixed right-4 bottom-20 z-40 md:bottom-6">
        <AnimatePresence>
          {isChatOpen ? (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className={classNames(
                "mb-2 w-[320px] rounded-2xl border shadow-2xl",
                isDark ? "border-white/10 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900",
              )}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                <p className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Bot size={14} /> AI Assistant
                </p>
                <button type="button" onClick={() => setIsChatOpen(false)} className="rounded p-1 hover:bg-white/10">
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto px-3 py-3 text-sm">
                {chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={classNames(
                      "rounded-xl px-3 py-2",
                      message.role === "assistant"
                        ? isDark
                          ? "bg-white/10 text-slate-100"
                          : "bg-slate-100 text-slate-800"
                        : "bg-linear-to-r from-indigo-600 to-cyan-500 text-white",
                    )}
                  >
                    {message.content}
                  </div>
                ))}
                {isChatLoading ? (
                  <p className={classNames("text-xs", isDark ? "text-slate-300" : "text-slate-500")}>
                    Thinking...
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 border-t border-white/10 p-3">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSendChat();
                    }
                  }}
                  placeholder="Ask about strategy or risks..."
                  className={classNames(
                    "flex-1 rounded-xl border px-3 py-2 text-sm outline-none",
                    isDark ? "border-white/20 bg-white/10 text-white" : "border-slate-300 text-slate-900",
                  )}
                />
                <button
                  type="button"
                  onClick={() => void handleSendChat()}
                  disabled={isChatLoading}
                  className="rounded-xl bg-linear-to-r from-indigo-600 to-cyan-500 p-2 text-white disabled:opacity-50"
                >
                  <Send size={14} />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <button
          type="button"
          onClick={() => setIsChatOpen((open) => !open)}
          className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-indigo-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-xl"
        >
          <Bot size={14} />
          {isChatOpen ? "Close Chat" : "Ask AI"}
        </button>
      </div>

      <AnimatePresence>
        {isMobileDepositOpen ? (
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileDepositOpen(false)}
          >
            <motion.div
              className="absolute right-0 bottom-0 left-0 rounded-t-3xl border border-white/10 bg-slate-950 p-5 text-white"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">Quick Deposit</h3>
                <button type="button" onClick={() => setIsMobileDepositOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-slate-300">
                <span className="inline-flex items-center gap-1">
                  Target: {selectedVault?.name ?? "N/A"}
                  {selectedVault ? (
                    <>
                      <LogoBadge
                        label={selectedVault.chain}
                        logoUrl={chainLogoMap[selectedVault.chain]}
                        size={14}
                      />
                      <span>({selectedVault.chain})</span>
                    </>
                  ) : null}
                </span>
              </p>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                className="mt-3 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none"
                placeholder="Amount (USDC)"
              />
              <button
                type="button"
                onClick={handleDeposit}
                disabled={isSubmitting || !selectedVault}
                className="mt-3 w-full rounded-xl bg-linear-to-r from-indigo-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSubmitting ? "Processing..." : isTestnetModeEnabled ? "Send Testnet Demo Tx" : "One-Click Deposit"}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showOnboarding ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              className="w-full max-w-md rounded-3xl border border-white/20 bg-slate-900 p-6 text-white shadow-2xl"
            >
              <p className="inline-flex items-center gap-2 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-200">
                <Sparkles size={13} /> Welcome
              </p>
              <h3 className="mt-3 text-2xl font-bold">Ready to earn in 3 steps</h3>
              <ol className="mt-4 space-y-2 text-sm text-slate-200">
                <li>1. Connect wallet</li>
                <li>2. Pick strategy profile</li>
                <li>3. Execute one-click deposit</li>
              </ol>
              <button
                type="button"
                className="mt-5 w-full rounded-xl bg-linear-to-r from-indigo-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white"
                onClick={() => {
                  setShowOnboarding(false);
                  window.localStorage.setItem("autopilot-onboarding-seen", "true");
                }}
              >
                Start Building Yield
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isTourOpen ? (
          <motion.div
            className="fixed inset-0 z-60 flex items-end justify-center bg-black/60 p-4 md:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsTourOpen(false)}
          >
            <motion.div
              className="w-full max-w-lg rounded-3xl border border-white/20 bg-slate-900 p-5 text-white shadow-2xl"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: "spring", damping: 24, stiffness: 280 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="inline-flex items-center gap-2 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-200">
                  <Sparkles size={12} /> Demo Tour
                </p>
                <button type="button" onClick={() => setIsTourOpen(false)}>
                  <X size={16} />
                </button>
              </div>

              <div className="mb-3 flex gap-1.5">
                {tourSteps.map((_, index) => (
                  <div
                    key={`tour-progress-${index}`}
                    className={classNames(
                      "h-1.5 flex-1 rounded-full",
                      index <= tourStepIndex ? "bg-cyan-400" : "bg-white/15",
                    )}
                  />
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={tourStepIndex}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="text-xl font-bold">{tourSteps[tourStepIndex].title}</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {tourSteps[tourStepIndex].description}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setTourStepIndex((index) => Math.max(index - 1, 0))}
                  disabled={tourStepIndex === 0}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/20 px-3 py-2 text-sm text-white disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                {tourStepIndex < tourSteps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setTourStepIndex((index) => Math.min(index + 1, tourSteps.length - 1))}
                    className="inline-flex items-center gap-1 rounded-xl bg-linear-to-r from-indigo-600 to-cyan-500 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsTourOpen(false)}
                    className="rounded-xl bg-linear-to-r from-indigo-600 to-cyan-500 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Finish Tour
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

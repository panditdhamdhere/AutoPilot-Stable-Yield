const zeroAddress = "0x0000000000000000000000000000000000000000";

const usdcByChain: Record<number, string> = {
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  10: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
  137: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  11155111: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
  84532: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
  421614: "0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d",
  11155420: "0x5fd84259d66cd46123540766be93d5dff56347d4",
  80002: "0x41e94eb019c0762f9b71d2b77d8b6f8b3b6f6b93",
};

export function getInputTokenForVaultSymbol(chainId: number, symbol: string): string {
  if (symbol.toUpperCase() === "ETH") return zeroAddress;
  return usdcByChain[chainId] ?? zeroAddress;
}

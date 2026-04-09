import { Dashboard } from "@/components/dashboard";
import { getVaults } from "@/lib/lifi";

export default async function Home() {
  const vaults = await getVaults();
  return <Dashboard vaults={vaults} />;
}

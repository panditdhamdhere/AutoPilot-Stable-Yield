"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Wand2, Wallet } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <motion.div
        className="pointer-events-none absolute -top-24 left-10 h-72 w-72 rounded-full bg-cyan-500/25 blur-3xl"
        animate={{ x: [0, 60, 0], y: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity }}
      />
      <motion.div
        className="pointer-events-none absolute top-28 right-0 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl"
        animate={{ x: [0, -60, 0], y: [0, -10, 0] }}
        transition={{ duration: 14, repeat: Infinity }}
      />

      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <motion.div variants={container} initial="hidden" animate="show" className="text-center">
          <motion.h1
            variants={item}
            className="mx-auto mt-5 max-w-4xl text-4xl font-bold leading-tight md:text-6xl"
          >
            AutoPilot Stable Yield
          </motion.h1>
          <motion.p variants={item} className="mx-auto mt-4 max-w-3xl text-base text-slate-200 md:text-xl">
            AI-style vault allocation powered by LI.FI Earn. Discover yield opportunities, execute
            one-click deposits, and track your DeFi portfolio in one elegant experience.
          </motion.p>
          <motion.div variants={item} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-indigo-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
            >
              Launch App <ArrowRight size={16} />
            </Link>
            <a
              href="https://docs.li.fi/earn/overview"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
            >
              View LI.FI Earn Docs
            </a>
          </motion.div>
        </motion.div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-16 md:grid-cols-3">
        {[
          {
            title: "Smart Allocation",
            desc: "Safe, balanced, and aggressive strategy profiles with transparent scoring.",
            icon: <Wand2 size={18} />,
          },
          {
            title: "One-Click Execution",
            desc: "Composer-powered quotes and wallet execution in a single flow.",
            icon: <Wallet size={18} />,
          },
          {
            title: "Portfolio Visibility",
            desc: "Track positions and value with a clean dashboard built for real users.",
            icon: <Shield size={18} />,
          },
        ].map((feature) => (
          <motion.article
            key={feature.title}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
          >
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">
              {feature.icon} {feature.title}
            </p>
            <p className="mt-2 text-sm text-slate-200">{feature.desc}</p>
          </motion.article>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-white/10 bg-linear-to-r from-indigo-900/60 to-slate-900 p-8">
          <h2 className="text-2xl font-bold md:text-3xl">Designed for seamless cross-chain yield access</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-200 md:text-base">
            AutoPilot Stable Yield combines LI.FI Earn vault discovery, one-click Composer execution,
            and live portfolio tracking in a single interface. Explore safely in testnet demo mode,
            then move to mainnet when you are ready for real execution.
          </p>
          <div className="mt-5">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
            >
              Open Dashboard <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black/20">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <h3 className="text-xl font-bold">AutoPilot Stable Yield</h3>
            <p className="mt-3 max-w-lg text-sm text-slate-300">
              A modern DeFi yield interface powered by LI.FI Earn, built for smooth cross-chain
              vault discovery, execution, and portfolio visibility.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Product</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p>
                <Link href="/dashboard" className="transition hover:text-white">
                  Dashboard
                </Link>
              </p>
              <p>
                <a
                  href="https://docs.li.fi/earn/overview"
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-white"
                >
                  Earn API Docs
                </a>
              </p>
              <p>
                <a
                  href="https://docs.li.fi/composer/overview"
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-white"
                >
                  Composer Docs
                </a>
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Community</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p>
                <a
                  href="https://li.fi"
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-white"
                >
                  LI.FI Website
                </a>
              </p>
              <p>
                <a
                  href="https://twitter.com/lifiprotocol"
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-white"
                >
                  X / Twitter
                </a>
              </p>
              <p>
                <a
                  href="https://discord.gg/lifi"
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-white"
                >
                  Discord
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-4 text-xs text-slate-400 md:flex-row md:items-center">
            <p>© {new Date().getFullYear()} AutoPilot Stable Yield. All rights reserved.</p>
            <p>Built with LI.FI Earn and Composer</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

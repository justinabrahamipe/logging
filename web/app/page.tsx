"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaArrowRight, FaBolt, FaFire, FaTrophy, FaTasks, FaColumns, FaChartLine, FaCrown } from "react-icons/fa";
import { useSession } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    try {
      const cached = sessionStorage.getItem("userSettings");
      if (cached && JSON.parse(cached).isPremium) { setIsPremium(true); return; }
    } catch {}
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.isPremium) setIsPremium(true);
    }).catch(() => {});
  }, [status]);

  const features = [
    { title: "Daily Scoring", desc: "Points-based action scores across life pillars", icon: FaBolt },
    { title: "Streaks & XP", desc: "Build momentum and level up over time", icon: FaFire },
    { title: "Goals & Timers", desc: "Track habits, targets, and outcomes", icon: FaTrophy },
    { title: "Smart Tasks", desc: "Recurring schedules, highlights, and more", icon: FaTasks },
    { title: "Life Pillars", desc: "Organize by what matters most to you", icon: FaColumns },
    { title: "Progress Insights", desc: "Charts, heatmaps, and effort metrics", icon: FaChartLine },
  ];

  const quickAccess = [
    { title: "Dashboard", description: "Your daily score and progress", icon: FaBolt, href: "/dashboard" },
    { title: "Tasks", description: "Complete your daily checklist", icon: FaTasks, href: "/today" },
    { title: "Pillars", description: "Configure your life areas", icon: FaColumns, href: "/pillars" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero */}
      <div className="relative h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
        {/* Subtle radial glow behind logo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] bg-zinc-800/40 rounded-full blur-[120px]" />
        </div>

        {/* Faint grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 text-center max-w-3xl mx-auto"
        >
          <motion.img
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            src="/icons/brand-icons/pwa_icon.png"
            alt="Grind Console"
            className="w-20 h-20 md:w-28 md:h-28 mx-auto mb-8 rounded-2xl shadow-2xl shadow-zinc-900/50 ring-1 ring-white/10"
          />

          <h1 className="text-5xl md:text-8xl font-bold text-white tracking-tight mb-3">
            Grind Console
          </h1>
          <p className="text-base md:text-lg text-zinc-500 mb-10 max-w-md mx-auto">
            Gamify your life. Score every day. Never break the chain.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            {status !== "authenticated" ? (
              <>
                <Link href="/login">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="bg-white text-zinc-900 px-8 py-3.5 rounded-lg font-semibold text-base min-w-[180px] flex items-center justify-center gap-2 group shadow-lg shadow-white/10"
                  >
                    Get Started
                    <FaArrowRight className="text-sm group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                </Link>
                <Link href="/dashboard">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="border border-zinc-700 text-zinc-400 px-8 py-3.5 rounded-lg font-medium text-base min-w-[180px] hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
                  >
                    See Demo
                  </motion.button>
                </Link>
              </>
            ) : (
              <Link href="/dashboard">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="bg-white text-zinc-900 px-8 py-3.5 rounded-lg font-semibold text-base min-w-[180px] flex items-center justify-center gap-2 group shadow-lg shadow-white/10"
                >
                  Go to Dashboard
                  <FaArrowRight className="text-sm group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </Link>
            )}
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 z-10"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-5 h-8 border-2 border-zinc-700 rounded-full flex items-start justify-center p-1"
          >
            <div className="w-1 h-1.5 bg-zinc-600 rounded-full" />
          </motion.div>
        </motion.div>
      </div>

      {/* Features */}
      <div className="py-24 px-4 bg-zinc-950 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Everything you need to stay on track
            </h2>
            <p className="text-zinc-500 max-w-lg mx-auto">
              A complete system for turning daily actions into long-term results.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-colors group"
              >
                <f.icon className="text-lg text-zinc-600 group-hover:text-white transition-colors mb-3" />
                <h3 className="font-semibold text-white text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-zinc-500">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Premium CTA */}
      {!isPremium && <div className="py-20 px-4 bg-zinc-950 border-t border-zinc-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="inline-flex p-3 rounded-xl bg-amber-500/10 mb-4">
            <FaCrown className="text-2xl text-amber-500" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Go Premium</h2>
          <p className="text-zinc-500 mb-6 max-w-md mx-auto">
            Remove ads, get early access to features, and support ongoing development.
          </p>
          <div className="flex items-baseline justify-center gap-1 mb-6">
            <span className="text-4xl font-bold text-white">£2.99</span>
            <span className="text-zinc-500">/month</span>
          </div>
          <Link href="/premium">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold rounded-xl transition-colors"
            >
              Learn More
            </motion.button>
          </Link>
        </motion.div>
      </div>}

      {/* Quick Access */}
      <div className="py-20 px-4 bg-zinc-950 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl font-bold text-white text-center mb-10"
          >
            Jump in
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-4">
            {quickAccess.map((item, index) => (
              <Link key={item.title} href={item.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -3 }}
                  className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 transition-all group cursor-pointer"
                >
                  <item.icon className="text-xl text-zinc-600 mb-4 group-hover:text-white transition-colors" />
                  <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-zinc-500">{item.description}</p>
                  <div className="flex items-center mt-4 text-zinc-600 group-hover:text-zinc-300 transition-colors">
                    <span className="text-xs font-medium">Open</span>
                    <FaArrowRight className="ml-1.5 text-[10px] group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

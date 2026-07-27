"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaCrown, FaCheck, FaBan, FaRocket, FaShieldAlt, FaStar } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { Snackbar, Alert as MuiAlert } from "@mui/material";

export default function PremiumPage() {
  const { data: session } = useSession();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });

  useEffect(() => {
    if (!session?.user) { setIsPremium(false); return; }
    const cached = sessionStorage.getItem("userSettings");
    if (cached) {
      try { const data = JSON.parse(cached); setIsPremium(!!data.isPremium); } catch {}
    }
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(data => {
      setIsPremium(data ? !!data.isPremium : false);
      if (data?.isPremium) {
        fetch("/api/stripe/subscription").then(r => r.ok ? r.json() : null).then(sub => {
          if (sub?.nextBillingDate) setNextBillingDate(sub.nextBillingDate);
          if (sub?.cancelAtPeriodEnd) setCancelAtPeriodEnd(true);
        }).catch(() => {});
      }
    }).catch(() => setIsPremium(false));
  }, [session]);

  const handlePromoActivate = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCode: promoInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsPremium(true);
        setPromoInput("");
        sessionStorage.setItem("userSettings", JSON.stringify(data));
        setSnackbar({ open: true, message: "Premium activated! Enjoy your ad-free experience.", severity: "success" });
      } else {
        const err = await res.json();
        setSnackbar({ open: true, message: err.error || "Invalid promo code", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Failed to activate code", severity: "error" });
    } finally {
      setPromoLoading(false);
    }
  };

  const features = [
    { icon: FaBan, title: "Ad-free experience", desc: "Browse without any interruptions" },
    { icon: FaRocket, title: "Early access", desc: "Be first to try new features" },
    { icon: FaShieldAlt, title: "Support development", desc: "Help keep the app running and improving" },
    { icon: FaStar, title: "Premium badge", desc: "Show your PRO status" },
  ];

  return (
    <div className="container mx-auto px-4 py-6 md:py-12 max-w-2xl">
      {isPremium === null ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-900 dark:border-t-zinc-100 rounded-full animate-spin" />
        </div>
      ) : (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

        {/* Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex p-4 rounded-2xl mb-4 ${isPremium ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
            <FaCrown className={`text-4xl ${isPremium ? 'text-amber-500' : 'text-zinc-400'}`} />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-2">
            {isPremium ? 'You\'re Premium' : 'Upgrade to Premium'}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {isPremium ? 'Thank you for supporting Grind Console!' : 'Remove ads and unlock the full experience'}
          </p>
        </div>

        {/* Premium Active State */}
        {isPremium ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-6 text-center">
              <span className="inline-block px-3 py-1 text-sm font-bold rounded-full bg-amber-200 dark:bg-amber-800/40 text-amber-800 dark:text-amber-300 mb-3">
                ACTIVE
              </span>
              <p className="text-zinc-700 dark:text-zinc-300">
                You have full premium access. Enjoy your ad-free experience across the entire app.
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                £2.99/month
                {cancelAtPeriodEnd
                  ? nextBillingDate ? ` — cancels on ${new Date(nextBillingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''
                  : nextBillingDate ? ` — next payment on ${new Date(nextBillingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ' — renews automatically each month'
                }
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Manage Subscription</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                Update payment method, view invoices, or cancel your subscription.
              </p>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/stripe/portal", { method: "POST" });
                    if (res.ok) {
                      const { url } = await res.json();
                      window.location.href = url;
                    } else {
                      setSnackbar({ open: true, message: "Could not open subscription management", severity: "error" });
                    }
                  } catch {
                    setSnackbar({ open: true, message: "Something went wrong", severity: "error" });
                  }
                }}
                className="px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-medium text-sm rounded-lg transition-colors"
              >
                Manage Subscription
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Pricing Card */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-zinc-900 dark:text-white">£2.99</span>
                  <span className="text-lg text-zinc-500 dark:text-zinc-400">/month</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {features.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <Icon className="text-sm text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{title}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href="https://buy.stripe.com/6oU4gA86g4XG0dudegak000"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 font-semibold rounded-xl transition-colors text-lg"
              >
                Subscribe — £2.99/month
              </a>
            </div>

            {/* Promo Code */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Have a promo code?</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePromoActivate()}
                  placeholder="Enter code"
                  className="flex-1 px-3 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
                <button
                  onClick={handlePromoActivate}
                  disabled={promoLoading || !promoInput.trim()}
                  className="px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {promoLoading ? "..." : "Activate"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Features list for premium users too */}
        {isPremium && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <Icon className="text-sm text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{title}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </div>
  );
}

"use client";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaBolt, FaColumns, FaTasks, FaBars, FaTimes, FaSignOutAlt, FaCog, FaDownload, FaHistory, FaChartLine, FaCalendarAlt, FaSun, FaMoon, FaEnvelope, FaMapMarkerAlt } from "react-icons/fa";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";

export default function Header() {
  const { theme, setTheme } = useTheme();
  const [isDark, setIsDark] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }

    if (isProfileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isProfileMenuOpen]);

  // Track actual dark mode state reactively
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstallable(false);
    setDeferredPrompt(null);
    setIsProfileMenuOpen(false);
    setIsMobileMenuOpen(false);
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: FaBolt },
    { href: "/tasks", label: "Tasks", icon: FaTasks },
    { href: "/goals", label: "Goals", icon: FaChartLine },
    { href: "/log", label: "Log", icon: FaMapMarkerAlt },
    { href: "/cycles", label: "Cycles", icon: FaCalendarAlt },
    { href: "/pillars", label: "Pillars", icon: FaColumns },
  ];

  const [headerStats, setHeaderStats] = useState<{
    todayScore: number | null;
    streak: number;
  } | null>(null);

  const fetchStats = async () => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const [scoreRes, historyRes] = await Promise.all([
        fetch(`/api/daily-score?date=${todayStr}`),
        fetch("/api/daily-score/history?days=30"),
      ]);
      let todayScore: number | null = null;
      if (scoreRes.ok) {
        const s = await scoreRes.json();
        todayScore = s.actionScore ?? null;
      }
      let streak = 0;
      if (historyRes.ok) {
        const hist = await historyRes.json();
        const scores: { date: string; actionScore: number }[] = hist.scores || [];
        const scoreMap = new Map<string, number>();
        for (const s of scores) scoreMap.set(s.date, s.actionScore);
        const d = new Date();
        d.setDate(d.getDate() - 1);
        while (true) {
          const ds = d.toISOString().split("T")[0];
          const sc = scoreMap.get(ds);
          if (sc !== undefined && sc >= 95) { streak++; d.setDate(d.getDate() - 1); }
          else break;
        }
      }
      const stats = { todayScore, streak };
      setHeaderStats(stats);
    } catch {
      // silently fail
    }
  };

  // Load cached stats from sessionStorage on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('header-stats');
      if (cached) {
        const { data, date } = JSON.parse(cached);
        if (date === new Date().toISOString().split("T")[0]) setHeaderStats(data);
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch stats on auth, and re-fetch when score changes
  useEffect(() => {
    if (status !== "authenticated") return;
    if (headerStats) return;
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Listen for score updates from tasks page
  useEffect(() => {
    const handler = () => fetchStats();
    window.addEventListener('score-updated', handler);
    return () => window.removeEventListener('score-updated', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authPages = ["/login", "/verify-request", "/error"];
  const isAuthPage = authPages.includes(pathname);

  if (isAuthPage) return null;

  const isLoggedIn = status === "authenticated";

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/90 dark:bg-zinc-950/90 border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/icons/icon-96x96.png" alt="Grind Console" className="w-11 h-11 rounded-lg" />
              <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                Grind Console
              </span>
            </div>
          </Link>

          {/* Quick Stats */}
          {headerStats && (
            <div className="flex items-center gap-2 md:gap-3 text-xs">
              {headerStats.todayScore !== null && (
                <div className="flex items-center gap-1" title="Today's Action Score">
                  <FaBolt className={`text-[10px] ${headerStats.todayScore >= 70 ? "text-emerald-500" : headerStats.todayScore >= 50 ? "text-amber-500" : "text-red-500"}`} />
                  <span className="font-medium text-zinc-600 dark:text-zinc-400">{headerStats.todayScore}%</span>
                </div>
              )}
              <div className="flex items-center gap-1" title="Current streak">
                <span className="font-medium text-zinc-600 dark:text-zinc-400">{headerStats.streak}🔥</span>
              </div>
            </div>
          )}

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <item.icon className="text-xs" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="ml-2 p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <FaSun className="text-sm" /> : <FaMoon className="text-sm" />}
            </button>

            {/* Install App (visible regardless of login) */}
            {isInstallable && (
              <button
                onClick={handleInstallClick}
                title="Install App"
                className="ml-2 p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <FaDownload className="text-sm" />
              </button>
            )}

            {/* Profile Menu / Sign In */}
            {isLoggedIn ? (
              <div className="relative ml-1" ref={profileMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="w-8 h-8 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
                  aria-label="Open profile menu"
                >
                  {session?.user?.image ? (
                    <img src={session.user.image} alt={session.user.name || "Profile"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
                      <span className="text-white dark:text-zinc-900 font-medium text-xs">{getInitials(session?.user?.name)}</span>
                    </div>
                  )}
                </button>

                <AnimatePresence>
                  {isProfileMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-52 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50 shadow-sm"
                    >
                      <div className="px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{session?.user?.name || "User"}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{session?.user?.email || ""}</p>
                      </div>

                      <div className="py-1">
                        <Link href="/activity">
                          <button
                            onClick={() => setIsProfileMenuOpen(false)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <FaHistory className="text-xs" />
                            Activity
                          </button>
                        </Link>

                        <Link href="/locations">
                          <button
                            onClick={() => setIsProfileMenuOpen(false)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <FaMapMarkerAlt className="text-xs" />
                            Locations
                          </button>
                        </Link>

                        <Link href="/settings">
                          <button
                            onClick={() => setIsProfileMenuOpen(false)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <FaCog className="text-xs" />
                            Settings
                          </button>
                        </Link>

                        <Link href="/contact">
                          <button
                            onClick={() => setIsProfileMenuOpen(false)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <FaEnvelope className="text-xs" />
                            Contact Us
                          </button>
                        </Link>

                        <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />

                        <button
                          onClick={handleSignOut}
                          className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <FaSignOutAlt className="text-xs" />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link href="/login">
                <button className="ml-2 px-3 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors">
                  Sign In
                </button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-1.5">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <FaSun className="text-sm" /> : <FaMoon className="text-sm" />}
            </button>

            {isLoggedIn && (
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="w-7 h-7 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700"
                aria-label="Profile"
              >
                {session?.user?.image ? (
                  <img src={session.user.image} alt={session.user.name || "Profile"} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
                    <span className="text-white dark:text-zinc-900 font-medium text-[10px]">{getInitials(session?.user?.name)}</span>
                  </div>
                )}
              </button>
            )}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <FaTimes className="text-lg" /> : <FaBars className="text-lg" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="md:hidden overflow-hidden border-t border-zinc-200 dark:border-zinc-800"
            >
              <div className="py-2 space-y-0.5">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors ${
                          isActive
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                            : "text-zinc-600 dark:text-zinc-300"
                        }`}
                      >
                        <item.icon className="text-sm" />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}

                <div className="border-t border-zinc-200 dark:border-zinc-800 my-2" />

                <div className="px-3 py-2">
                  {isInstallable && (
                    <div
                      onClick={handleInstallClick}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer"
                    >
                      <FaDownload className="text-sm" />
                      Install App
                    </div>
                  )}

                  {isLoggedIn ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700">
                          {session?.user?.image ? (
                            <img src={session.user.image} alt={session.user.name || "Profile"} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
                              <span className="text-white dark:text-zinc-900 font-medium text-xs">{getInitials(session?.user?.name)}</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{session?.user?.name || "User"}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{session?.user?.email || ""}</p>
                        </div>
                      </div>

                      <Link href="/activity">
                        <div onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-zinc-600 dark:text-zinc-300">
                          <FaHistory className="text-sm" />
                          Activity
                        </div>
                      </Link>

                      <Link href="/locations">
                        <div onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-zinc-600 dark:text-zinc-300">
                          <FaMapMarkerAlt className="text-sm" />
                          Locations
                        </div>
                      </Link>

                      <Link href="/settings">
                        <div onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-zinc-600 dark:text-zinc-300">
                          <FaCog className="text-sm" />
                          Settings
                        </div>
                      </Link>

                      <Link href="/contact">
                        <div onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-zinc-600 dark:text-zinc-300">
                          <FaEnvelope className="text-sm" />
                          Contact Us
                        </div>
                      </Link>

                      <div
                        onClick={handleSignOut}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-red-600 dark:text-red-400 cursor-pointer"
                      >
                        <FaSignOutAlt className="text-sm" />
                        Sign Out
                      </div>
                    </div>
                  ) : (
                    <Link href="/login">
                      <div
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center justify-center px-3 py-2.5 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium cursor-pointer"
                      >
                        Sign In
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </nav>

      {/* Mobile Bottom Tab Bar — outside nav to avoid sticky/fixed conflict */}
      {!isAuthPage && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-around h-12 pb-[env(safe-area-inset-bottom)]">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className="flex-1">
                  <div className={`flex flex-col items-center gap-0.5 py-1 ${
                    isActive
                      ? "text-zinc-900 dark:text-white"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}>
                    <item.icon className="text-base" />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

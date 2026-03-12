"use client";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaBolt, FaColumns, FaTasks, FaBars, FaTimes, FaSignOutAlt, FaCog, FaDownload, FaHistory, FaChartLine, FaCalendarAlt, FaFire, FaSun, FaMoon } from "react-icons/fa";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";

export default function Header() {
  const { theme, setTheme } = useTheme();
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
    { href: "/cycles", label: "Cycles", icon: FaCalendarAlt },
    { href: "/pillars", label: "Pillars", icon: FaColumns },
  ];

  const [headerStats, setHeaderStats] = useState<{
    todayScore: number | null;
    streak: number;
    momentum: number | null;
    trajectory: number | null;
  } | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    const fetchStats = async () => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const [scoreRes, statsRes, momRes] = await Promise.all([
          fetch(`/api/daily-score?date=${todayStr}`),
          fetch("/api/user-stats"),
          fetch("/api/momentum"),
        ]);
        let todayScore: number | null = null;
        if (scoreRes.ok) {
          const s = await scoreRes.json();
          todayScore = s.actionScore ?? null;
        }
        let streak = 0;
        if (statsRes.ok) {
          const st = await statsRes.json();
          streak = st.currentStreak || 0;
        }
        let momentum: number | null = null;
        let trajectory: number | null = null;
        if (momRes.ok) {
          const m = await momRes.json();
          if (m.overall != null) momentum = m.overall;
          if (m.trajectory?.overall != null) trajectory = m.trajectory.overall;
        }
        setHeaderStats({ todayScore, streak, momentum, trajectory });
      } catch {
        // silently fail
      }
    };
    fetchStats();
  }, [status]);

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
              <div className="w-7 h-7 bg-zinc-900 dark:bg-white rounded-md flex items-center justify-center">
                <span className="text-white dark:text-zinc-900 font-bold text-sm">T</span>
              </div>
              <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                TotalLogger
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
              {headerStats.streak > 0 && (
                <div className="flex items-center gap-1" title="Current streak">
                  <FaFire className="text-[10px] text-orange-500" />
                  <span className="font-medium text-zinc-600 dark:text-zinc-400">{headerStats.streak}</span>
                </div>
              )}
              {headerStats.momentum !== null && (
                <div className="flex items-center gap-1" title="Momentum: pace of habitual & target goals">
                  <FaChartLine className={`text-[10px] ${headerStats.momentum >= 1.0 ? "text-emerald-500" : "text-red-500"}`} />
                  <span className={`font-medium ${headerStats.momentum >= 1.0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {headerStats.momentum.toFixed(1)}x
                  </span>
                </div>
              )}
              {headerStats.trajectory !== null && (
                <div className="flex items-center gap-1" title="Trajectory: pace of outcome goals">
                  <FaChartLine className={`text-[10px] ${headerStats.trajectory >= 1.0 ? "text-purple-500" : "text-red-500"}`} />
                  <span className={`font-medium ${headerStats.trajectory >= 1.0 ? "text-purple-600 dark:text-purple-400" : "text-red-600 dark:text-red-400"}`}>
                    {headerStats.trajectory.toFixed(1)}x
                  </span>
                </div>
              )}
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
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="ml-2 p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <FaSun className="text-sm" /> : <FaMoon className="text-sm" />}
            </button>

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
                        {isInstallable && (
                          <button
                            onClick={handleInstallClick}
                            className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <FaDownload className="text-xs" />
                            Install App
                          </button>
                        )}

                        <Link href="/activity">
                          <button
                            onClick={() => setIsProfileMenuOpen(false)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <FaHistory className="text-xs" />
                            Activity
                          </button>
                        </Link>

                        <Link href="/reports">
                          <button
                            onClick={() => setIsProfileMenuOpen(false)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <FaChartLine className="text-xs" />
                            Reports
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
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <FaSun className="text-sm" /> : <FaMoon className="text-sm" />}
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

                      {isInstallable && (
                        <div
                          onClick={handleInstallClick}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer"
                        >
                          <FaDownload className="text-sm" />
                          Install App
                        </div>
                      )}

                      <Link href="/activity">
                        <div onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-zinc-600 dark:text-zinc-300">
                          <FaHistory className="text-sm" />
                          Activity
                        </div>
                      </Link>

                      <Link href="/settings">
                        <div onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-zinc-600 dark:text-zinc-300">
                          <FaCog className="text-sm" />
                          Settings
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

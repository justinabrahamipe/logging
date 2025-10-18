"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaBullseye, FaClipboardList, FaTasks, FaFlag, FaBars, FaTimes, FaSignOutAlt, FaCog, FaUser, FaUsers, FaMapMarkedAlt, FaBook } from "react-icons/fa";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [enabledFeatures, setEnabledFeatures] = useState({
    todo: false,
    goals: false,
    people: false,
    places: false,
  });
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Fetch user preferences to determine enabled features
  useEffect(() => {
    async function fetchPreferences() {
      if (session?.user?.id) {
        try {
          const response = await fetch("/api/preferences");
          if (response.ok) {
            const data = await response.json();
            setEnabledFeatures({
              todo: data.enableTodo || false,
              goals: data.enableGoals || false,
              people: data.enablePeople || false,
              places: data.enablePlaces || false,
            });
          }
        } catch (error) {
          console.error("Failed to fetch preferences:", error);
        }
      }
    }
    fetchPreferences();
  }, [session]);

  // Close profile menu when clicking outside
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

  // All possible nav items
  const allNavItems = [
    { href: "/activities", label: "Activities", icon: FaBullseye, enabled: true }, // Always enabled
    { href: "/log", label: "Log", icon: FaClipboardList, enabled: true }, // Always enabled
    { href: "/bible", label: "Bible", icon: FaBook, enabled: true }, // Always enabled
    { href: "/todo", label: "Todo", icon: FaTasks, enabled: enabledFeatures.todo },
    { href: "/goals", label: "Goals", icon: FaFlag, enabled: enabledFeatures.goals },
    { href: "/people", label: "People", icon: FaUsers, enabled: enabledFeatures.people },
    { href: "/places", label: "Places", icon: FaMapMarkedAlt, enabled: enabledFeatures.places },
  ];

  // Filter to show only enabled features
  const navItems = allNavItems.filter(item => item.enabled);

  // Hide header on auth-related pages, or on homepage when not authenticated
  const authPages = ["/login", "/verify-request", "/error"];
  const isAuthPage = authPages.includes(pathname);
  const isHomePage = pathname === "/";

  // Hide on auth pages
  if (isAuthPage) {
    return null;
  }

  // Hide on homepage only if not authenticated
  if (isHomePage && status === "unauthenticated") {
    return null;
  }

  // Hide on all other pages if not authenticated
  if (!isHomePage && status === "unauthenticated") {
    return null;
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-700/50">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">L</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Total Logger
              </span>
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                    }`}
                  >
                    <item.icon className="text-sm" />
                    <span className="font-medium">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-blue-50 dark:bg-blue-900/20 rounded-lg -z-10"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </motion.div>
                </Link>
              );
            })}

            {/* Profile Menu */}
            <div className="relative ml-2" ref={profileMenuRef}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                aria-label="Open profile menu"
              >
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "Profile"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {getInitials(session?.user?.name)}
                    </span>
                  </div>
                )}
              </motion.button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {isProfileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
                  >
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {session?.user?.name || "User"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {session?.user?.email || ""}
                      </p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Link href="/preferences">
                        <motion.button
                          whileHover={{ backgroundColor: "rgba(59, 130, 246, 0.1)" }}
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="w-full px-4 py-2 text-left flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <FaCog className="text-lg" />
                          <span className="font-medium">Preferences</span>
                        </motion.button>
                      </Link>

                      <motion.button
                        whileHover={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                        onClick={handleSignOut}
                        className="w-full px-4 py-2 text-left flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <FaSignOutAlt className="text-lg" />
                        <span className="font-medium">Sign Out</span>
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            {/* Profile Photo - Mobile */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-300 dark:border-gray-600"
              aria-label="Profile"
            >
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || "Profile"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">
                    {getInitials(session?.user?.name)}
                  </span>
                </div>
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-gray-700 dark:text-gray-300"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <FaTimes className="text-xl" /> : <FaBars className="text-xl" />}
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu */}
        <motion.div
          initial={false}
          animate={{
            height: isMobileMenuOpen ? "auto" : 0,
            opacity: isMobileMenuOpen ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
          className="md:hidden overflow-hidden"
        >
          <div className="py-4 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <item.icon />
                    <span className="font-medium">{item.label}</span>
                  </motion.div>
                </Link>
              );
            })}

            {/* User Info - Mobile */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-300 dark:border-gray-600">
                  {session?.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "Profile"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-semibold text-xs">
                        {getInitials(session?.user?.name)}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {session?.user?.name || "User"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {session?.user?.email || ""}
                  </p>
                </div>
              </div>

              <Link href="/preferences">
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer mb-2"
                >
                  <FaCog />
                  <span className="font-medium">Preferences</span>
                </motion.div>
              </Link>

              <motion.div
                whileTap={{ scale: 0.98 }}
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
              >
                <FaSignOutAlt />
                <span className="font-medium">Sign Out</span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </nav>
  );
}

"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaDollarSign, FaWallet, FaChartLine, FaExchangeAlt, FaTags, FaHandHoldingUsd } from "react-icons/fa";

const financeMenuItems = [
  { href: "/finance/accounts", label: "Accounts", icon: FaWallet },
  { href: "/finance/transactions", label: "Transactions", icon: FaExchangeAlt },
  { href: "/finance/categories", label: "Categories", icon: FaTags },
  { href: "/finance/debts", label: "Debts & Loans", icon: FaHandHoldingUsd },
  { href: "/finance/reports", label: "Reports", icon: FaChartLine },
];

export default function FinanceSubmenu() {
  const pathname = usePathname();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 md:mb-8"
    >
      <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
        <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
          <FaDollarSign className="text-white text-xl md:text-2xl" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white truncate">
            Finance
          </h1>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 hidden sm:block">Track your financial activities</p>
        </div>
      </div>

      {/* Submenu Navigation - Horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-2 min-w-max md:min-w-0 md:flex-wrap pb-2 md:pb-0">
          {financeMenuItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-green-600 text-white shadow-lg"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500"
                  }`}
                >
                  <item.icon className="text-sm" />
                  <span className="font-medium text-sm md:text-base">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FaDollarSign, FaWallet, FaChartLine, FaExchangeAlt, FaTags, FaHandHoldingUsd } from "react-icons/fa";
import FinanceSubmenu from "./(components)/FinanceSubmenu";

const financeMenuItems = [
  { href: "/finance/accounts", label: "Accounts", icon: FaWallet },
  { href: "/finance/transactions", label: "Transactions", icon: FaExchangeAlt },
  { href: "/finance/categories", label: "Categories", icon: FaTags },
  { href: "/finance/debts", label: "Debts & Loans", icon: FaHandHoldingUsd },
  { href: "/finance/reports", label: "Reports", icon: FaChartLine },
];

export default function FinancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 py-4 md:py-8">
      <div className="max-w-7xl mx-auto px-4">
        <FinanceSubmenu />

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8"
        >
          <div className="text-center py-12">
            <FaDollarSign className="mx-auto text-6xl text-green-500 dark:text-green-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Finance Dashboard
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Select a section from the menu above to get started
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {financeMenuItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-700 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <item.icon className="text-3xl text-green-600 dark:text-green-400 mb-3 mx-auto" />
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                      {item.label}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Manage your {item.label.toLowerCase()}
                    </p>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

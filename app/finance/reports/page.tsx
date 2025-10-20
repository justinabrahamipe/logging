"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaArrowUp, FaArrowDown, FaCalendarDay, FaCalendarWeek, FaCalendar, FaWallet, FaChartLine } from "react-icons/fa";
import axios from "axios";
import FinanceSubmenu from "../(components)/FinanceSubmenu";

interface Stats {
  income: number;
  expense: number;
  balance: number;
}

interface ReportData {
  today: Stats;
  week: Stats;
  month: Stats;
  accounts: {
    total: number;
    totalBalance: number;
    accounts: Array<{
      id: number;
      name: string;
      balance: number;
      currency: string;
      type: string;
    }>;
  };
}

export default function ReportsPage() {
  const [stats, setStats] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const baseUrl = window.location.origin;
      const response = await axios.get(`${baseUrl}/api/finance/reports/stats`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <FinanceSubmenu />
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-600 dark:text-gray-400">Loading reports...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <FinanceSubmenu />
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-600 dark:text-gray-400">No data available</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 py-4 md:py-8">
      <div className="max-w-7xl mx-auto px-4">
        <FinanceSubmenu />

        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            Financial Reports
          </h2>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Overview of your income and expenses
          </p>
        </div>

        {/* Period Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Today */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6"
          >
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <FaCalendarDay className="text-white text-lg md:text-xl" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">Today</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaArrowDown className="text-green-600 dark:text-green-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Income</span>
                </div>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(stats.today.income)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaArrowUp className="text-red-600 dark:text-red-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Expenses</span>
                </div>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(stats.today.expense)}
                </span>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Balance</span>
                  <span className={`text-xl font-bold ${
                    stats.today.balance >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {formatCurrency(stats.today.balance)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* This Week */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <FaCalendarWeek className="text-white text-xl" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">This Week</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Last 7 days
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaArrowDown className="text-green-600 dark:text-green-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Income</span>
                </div>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(stats.week.income)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaArrowUp className="text-red-600 dark:text-red-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Expenses</span>
                </div>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(stats.week.expense)}
                </span>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Balance</span>
                  <span className={`text-xl font-bold ${
                    stats.week.balance >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {formatCurrency(stats.week.balance)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* This Month */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <FaCalendar className="text-white text-xl" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">This Month</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaArrowDown className="text-green-600 dark:text-green-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Income</span>
                </div>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(stats.month.income)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaArrowUp className="text-red-600 dark:text-red-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Expenses</span>
                </div>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(stats.month.expense)}
                </span>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Balance</span>
                  <span className={`text-xl font-bold ${
                    stats.month.balance >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {formatCurrency(stats.month.balance)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Accounts Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <FaWallet className="text-white text-xl" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Account Balances</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {stats.accounts.total} accounts • Total: {formatCurrency(stats.accounts.totalBalance)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.accounts.accounts.map((account) => (
              <div
                key={account.id}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-gray-900 dark:text-white">{account.name}</h4>
                  <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded capitalize">
                    {account.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(account.balance)}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {account.currency}
                </div>
              </div>
            ))}
          </div>

          {stats.accounts.accounts.length === 0 && (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No accounts found. Create an account to start tracking your finances.
            </div>
          )}
        </motion.div>

        {/* Additional Insights Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg p-8 text-white text-center"
        >
          <FaChartLine className="mx-auto text-6xl mb-4 opacity-80" />
          <h3 className="text-2xl font-bold mb-2">More Reports Coming Soon</h3>
          <p className="opacity-90">
            Charts, spending patterns, category breakdowns, and more detailed analytics will be available here.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

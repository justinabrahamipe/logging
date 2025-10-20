"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaCreditCard, FaUniversity, FaWallet, FaChartLine, FaEllipsisH, FaTimes, FaCheck } from "react-icons/fa";
import axios from "axios";
import FinanceSubmenu from "../(components)/FinanceSubmenu";

interface Account {
  id: number;
  name: string;
  currency: string;
  type: string;
  balance: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

const accountTypeIcons: Record<string, any> = {
  credit_card: FaCreditCard,
  bank: FaUniversity,
  cash: FaWallet,
  investment: FaChartLine,
  other: FaEllipsisH,
};

const accountTypeLabels: Record<string, string> = {
  credit_card: "Credit Card",
  bank: "Bank Account",
  cash: "Cash",
  investment: "Investment",
  other: "Other",
};

const accountTypes = [
  { value: "credit_card", label: "Credit Card" },
  { value: "bank", label: "Bank Account" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" },
];

const currencies = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "CHF", label: "CHF - Swiss Franc" },
  { value: "CNY", label: "CNY - Chinese Yuan" },
  { value: "INR", label: "INR - Indian Rupee" },
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    currency: "USD",
    type: "bank",
    balance: 0,
    description: "",
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const baseUrl = window.location.origin;
      const response = await axios.get(`${baseUrl}/api/finance/accounts`);
      setAccounts(response.data.data || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name,
        currency: account.currency,
        type: account.type,
        balance: account.balance,
        description: account.description || "",
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: "",
        currency: "USD",
        type: "bank",
        balance: 0,
        description: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseUrl = window.location.origin;

      if (editingAccount) {
        // Update existing account
        await axios.put(`${baseUrl}/api/finance/accounts`, {
          id: editingAccount.id,
          ...formData,
        });
      } else {
        // Create new account
        await axios.post(`${baseUrl}/api/finance/accounts`, formData);
      }

      fetchAccounts();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving account:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this account?")) {
      return;
    }

    try {
      const baseUrl = window.location.origin;
      await axios.delete(`${baseUrl}/api/finance/accounts?id=${id}`);
      fetchAccounts();
    } catch (error) {
      console.error("Error deleting account:", error);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <FinanceSubmenu />
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-600 dark:text-gray-400">Loading accounts...</div>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            Accounts
          </h2>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage your financial accounts
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleOpenModal()}
          className="px-4 md:px-6 py-2.5 md:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-lg flex items-center justify-center gap-2 w-full sm:w-auto text-sm md:text-base"
        >
          <FaPlus />
          Add Account
        </motion.button>
      </div>

        {/* Accounts Grid */}
        {accounts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 md:p-12">
            <div className="text-center">
              <FaWallet className="mx-auto text-5xl md:text-6xl text-gray-300 dark:text-gray-600 mb-4" />
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                No Accounts Yet
              </h2>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-6">
                Get started by adding your first financial account
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleOpenModal()}
                className="px-4 md:px-6 py-2.5 md:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-lg inline-flex items-center gap-2 text-sm md:text-base"
              >
                <FaPlus />
                Add Your First Account
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {accounts.map((account) => {
              const Icon = accountTypeIcons[account.type] || FaEllipsisH;
              return (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="text-white text-lg md:text-xl" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white truncate text-sm md:text-base">
                          {account.name}
                        </h3>
                        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 truncate">
                          {accountTypeLabels[account.type]}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 md:gap-2 flex-shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleOpenModal(account)}
                        className="p-1.5 md:p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                      >
                        <FaEdit className="text-sm md:text-base" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(account.id)}
                        className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <FaTrash className="text-sm md:text-base" />
                      </motion.button>
                    </div>
                  </div>

                  <div className="mb-3 md:mb-4">
                    <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(account.balance, account.currency)}
                    </div>
                    <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                      Current Balance
                    </div>
                  </div>

                  {account.description && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {account.description}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    Created: {new Date(account.createdAt).toLocaleDateString()}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCloseModal}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 z-10 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {editingAccount ? "Edit Account" : "Add Account"}
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <FaTimes />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Account Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="e.g., Chase Checking"
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Account Type *
                    </label>
                    <select
                      required
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      {accountTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Currency *
                    </label>
                    <select
                      required
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      {currencies.map((currency) => (
                        <option key={currency.value} value={currency.value}>
                          {currency.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Balance */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Initial Balance
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Add notes about this account..."
                      rows={3}
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCloseModal}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <FaCheck />
                      {editingAccount ? "Update" : "Create"}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

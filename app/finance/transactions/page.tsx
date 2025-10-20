"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaTimes, FaCheck, FaExchangeAlt, FaArrowDown, FaArrowUp, FaCalendar, FaMapMarkerAlt, FaUser } from "react-icons/fa";
import axios from "axios";
import FinanceSubmenu from "../(components)/FinanceSubmenu";

interface Account {
  id: number;
  name: string;
  currency: string;
  type: string;
  balance: number;
}

interface Contact {
  id: number;
  name: string;
  photoUrl?: string;
}

interface Place {
  id: number;
  name: string;
  address: string;
}

interface Transaction {
  id: number;
  fromAccountId?: number;
  toAccountId?: number;
  fromAccount?: Account;
  toAccount?: Account;
  amount: number;
  currency: string;
  exchangeRate?: number;
  convertedAmount?: number;
  type: string;
  category?: string;
  description: string;
  isNeed: boolean;
  transactionDate: string;
  transactionContacts: { contact: Contact }[];
  transactionPlaces: { place: Place }[];
  createdAt: string;
}

const defaultCategories = {
  expense: ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Health", "Education", "Other"],
  income: ["Salary", "Freelance", "Investment", "Gift", "Refund", "Other"],
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(defaultCategories.expense);
  const [incomeCategories, setIncomeCategories] = useState<string[]>(defaultCategories.income);
  const [newCategory, setNewCategory] = useState("");
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [formData, setFormData] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: 0,
    currency: "USD",
    exchangeRate: 1,
    type: "expense",
    category: "",
    description: "",
    isNeed: true,
    transactionDate: new Date().toISOString().split('T')[0],
    contactIds: [] as number[],
    placeIds: [] as number[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const baseUrl = window.location.origin;

      // Fetch all data with individual error handling
      let accountsRes, transactionsRes, contactsRes, placesRes;

      try {
        accountsRes = await axios.get(`${baseUrl}/api/finance/accounts`);
      } catch (err) {
        console.error("Error fetching accounts:", err);
        accountsRes = { data: { data: [] } };
      }

      try {
        transactionsRes = await axios.get(`${baseUrl}/api/finance/transactions`);
      } catch (err) {
        console.error("Error fetching transactions:", err);
        transactionsRes = { data: { data: [] } };
      }

      try {
        contactsRes = await axios.get(`${baseUrl}/api/contacts`);
      } catch (err) {
        console.error("Error fetching contacts:", err);
        contactsRes = { data: { data: [] } };
      }

      try {
        placesRes = await axios.get(`${baseUrl}/api/places`);
      } catch (err) {
        console.error("Error fetching places:", err);
        placesRes = { data: { data: [] } };
      }

      setAccounts(accountsRes.data.data || []);
      setTransactions(transactionsRes.data.data || []);
      setContacts(contactsRes.data.data || []);
      setPlaces(placesRes.data.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setFormData({
        fromAccountId: transaction.fromAccountId?.toString() || "",
        toAccountId: transaction.toAccountId?.toString() || "",
        amount: transaction.amount,
        currency: transaction.currency,
        exchangeRate: transaction.exchangeRate || 1,
        type: transaction.type,
        category: transaction.category || "",
        description: transaction.description,
        isNeed: transaction.isNeed,
        transactionDate: transaction.transactionDate.split('T')[0],
        contactIds: transaction.transactionContacts.map(tc => tc.contact.id),
        placeIds: transaction.transactionPlaces.map(tp => tp.place.id),
      });
    } else {
      setEditingTransaction(null);
      setFormData({
        fromAccountId: "",
        toAccountId: "",
        amount: 0,
        currency: "USD",
        exchangeRate: 1,
        type: "expense",
        category: "",
        description: "",
        isNeed: true,
        transactionDate: new Date().toISOString().split('T')[0],
        contactIds: [],
        placeIds: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
    setShowCategoryInput(false);
    setNewCategory("");
  };

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      if (formData.type === "expense") {
        if (!expenseCategories.includes(newCategory.trim())) {
          setExpenseCategories([...expenseCategories, newCategory.trim()]);
          setFormData({ ...formData, category: newCategory.trim() });
        }
      } else if (formData.type === "income") {
        if (!incomeCategories.includes(newCategory.trim())) {
          setIncomeCategories([...incomeCategories, newCategory.trim()]);
          setFormData({ ...formData, category: newCategory.trim() });
        }
      }
      setNewCategory("");
      setShowCategoryInput(false);
    }
  };

  const getCurrentCategories = () => {
    return formData.type === "expense" ? expenseCategories : incomeCategories;
  };

  const getSelectedAccount = (accountId: string) => {
    return accounts.find(a => a.id.toString() === accountId);
  };

  const handleAccountChange = (field: "fromAccountId" | "toAccountId", value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      const account = getSelectedAccount(value);
      if (account) {
        newData.currency = account.currency;
      }

      // Check if we need exchange rate
      if (field === "fromAccountId" && prev.toAccountId) {
        const toAccount = getSelectedAccount(prev.toAccountId);
        if (toAccount && account && toAccount.currency !== account.currency) {
          // Different currencies - keep exchange rate field
        } else {
          newData.exchangeRate = 1;
        }
      } else if (field === "toAccountId" && prev.fromAccountId) {
        const fromAccount = getSelectedAccount(prev.fromAccountId);
        if (fromAccount && account && fromAccount.currency !== account.currency) {
          // Different currencies - keep exchange rate field
        } else {
          newData.exchangeRate = 1;
        }
      }

      return newData;
    });
  };

  const needsExchangeRate = () => {
    const fromAccount = getSelectedAccount(formData.fromAccountId);
    const toAccount = getSelectedAccount(formData.toAccountId);
    return fromAccount && toAccount && fromAccount.currency !== toAccount.currency;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseUrl = window.location.origin;

      const payload: any = {
        ...formData,
        fromAccountId: formData.fromAccountId ? parseInt(formData.fromAccountId) : null,
        toAccountId: formData.toAccountId ? parseInt(formData.toAccountId) : null,
      };

      // Calculate converted amount if needed
      if (needsExchangeRate()) {
        payload.convertedAmount = formData.amount * formData.exchangeRate;
      }

      if (editingTransaction) {
        await axios.put(`${baseUrl}/api/finance/transactions`, {
          id: editingTransaction.id,
          ...payload,
        });
      } else {
        await axios.post(`${baseUrl}/api/finance/transactions`, payload);
      }

      fetchData();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving transaction:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    try {
      const baseUrl = window.location.origin;
      await axios.delete(`${baseUrl}/api/finance/transactions?id=${id}`);
      fetchData();
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "income":
        return <FaArrowDown className="text-green-600 dark:text-green-400" />;
      case "expense":
        return <FaArrowUp className="text-red-600 dark:text-red-400" />;
      case "transfer":
        return <FaExchangeAlt className="text-blue-600 dark:text-blue-400" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <FinanceSubmenu />
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-600 dark:text-gray-400">Loading transactions...</div>
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
              Transactions
            </h2>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
              Track your income, expenses, and transfers ({accounts.length} accounts loaded)
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenModal()}
            className="px-4 md:px-6 py-2.5 md:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-lg flex items-center justify-center gap-2 w-full sm:w-auto text-sm md:text-base"
          >
            <FaPlus />
            Add Transaction
          </motion.button>
        </div>

        {/* Transactions List */}
        {transactions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 md:p-12">
            <div className="text-center">
              <FaExchangeAlt className="mx-auto text-5xl md:text-6xl text-gray-300 dark:text-gray-600 mb-4" />
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                No Transactions Yet
              </h2>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-6">
                Start tracking your financial activities
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleOpenModal()}
                className="px-4 md:px-6 py-2.5 md:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-lg inline-flex items-center gap-2 text-sm md:text-base"
              >
                <FaPlus />
                Add Your First Transaction
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {transactions.map((transaction) => (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6"
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                  <div className="flex items-start gap-3 md:gap-4 flex-1 w-full min-w-0">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      {getTransactionIcon(transaction.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm md:text-base truncate">
                          {transaction.description}
                        </h3>
                        {transaction.category && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded whitespace-nowrap">
                            {transaction.category}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${
                          transaction.isNeed
                            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                            : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                        }`}>
                          {transaction.isNeed ? "Need" : "Want"}
                        </span>
                      </div>
                      <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        {transaction.type === "transfer" && transaction.fromAccount && transaction.toAccount && (
                          <div className="truncate">
                            {transaction.fromAccount.name} → {transaction.toAccount.name}
                            {transaction.exchangeRate && transaction.exchangeRate !== 1 && (
                              <span className="ml-2 text-xs">
                                (Rate: {transaction.exchangeRate})
                              </span>
                            )}
                          </div>
                        )}
                        {transaction.type === "expense" && transaction.fromAccount && (
                          <div className="truncate">From: {transaction.fromAccount.name}</div>
                        )}
                        {transaction.type === "income" && transaction.toAccount && (
                          <div className="truncate">To: {transaction.toAccount.name}</div>
                        )}
                        <div className="flex items-center gap-2">
                          <FaCalendar className="text-xs flex-shrink-0" />
                          <span>{new Date(transaction.transactionDate).toLocaleDateString()}</span>
                        </div>
                        {transaction.transactionPlaces.length > 0 && (
                          <div className="flex items-center gap-2">
                            <FaMapMarkerAlt className="text-xs flex-shrink-0" />
                            <span className="truncate">{transaction.transactionPlaces.map(tp => tp.place.name).join(", ")}</span>
                          </div>
                        )}
                        {transaction.transactionContacts.length > 0 && (
                          <div className="flex items-center gap-2">
                            <FaUser className="text-xs flex-shrink-0" />
                            <span className="truncate">{transaction.transactionContacts.map(tc => tc.contact.name).join(", ")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end gap-3 w-full sm:w-auto justify-between sm:justify-start">
                    <div className="text-left sm:text-right">
                      <div className={`text-lg md:text-2xl font-bold ${
                        transaction.type === "income"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(transaction.amount, transaction.currency)}
                      </div>
                      {transaction.convertedAmount && transaction.convertedAmount !== transaction.amount && (
                        <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                          ≈ {formatCurrency(transaction.convertedAmount, transaction.toAccount?.currency || "USD")}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleOpenModal(transaction)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg touch-target"
                      >
                        <FaEdit className="text-sm md:text-base" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(transaction.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg touch-target"
                      >
                        <FaTrash className="text-sm md:text-base" />
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
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
                className="relative bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-xl max-w-2xl w-full p-4 sm:p-6 z-10 max-h-[90vh] overflow-y-auto smooth-scroll"
              >
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                    {editingTransaction ? "Edit Transaction" : "Add Transaction"}
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 touch-target"
                  >
                    <FaTimes className="text-lg md:text-xl" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
                  {/* Transaction Type */}
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2">
                      Type *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {["expense", "income", "transfer"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData({ ...formData, type })}
                          className={`px-3 py-2 md:py-2.5 rounded-lg capitalize text-sm md:text-base transition-colors touch-target ${
                            formData.type === type
                              ? "bg-green-600 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* From Account */}
                    {(formData.type === "expense" || formData.type === "transfer") && (
                      <div className="sm:col-span-1">
                        <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2">
                          From Account *
                        </label>
                        <select
                          required
                          value={formData.fromAccountId}
                          onChange={(e) => handleAccountChange("fromAccountId", e.target.value)}
                          className="w-full px-3 py-2.5 md:py-3 text-sm md:text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent touch-target"
                        >
                          <option value="">Select account ({accounts.length} available)</option>
                          {accounts.length === 0 && (
                            <option disabled>No accounts - please create one first</option>
                          )}
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name} - {formatCurrency(account.balance, account.currency)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* To Account */}
                    {(formData.type === "income" || formData.type === "transfer") && (
                      <div className="sm:col-span-1">
                        <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2">
                          To Account *
                        </label>
                        <select
                          required
                          value={formData.toAccountId}
                          onChange={(e) => handleAccountChange("toAccountId", e.target.value)}
                          className="w-full px-3 py-2.5 md:py-3 text-sm md:text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent touch-target"
                        >
                          <option value="">Select account ({accounts.length} available)</option>
                          {accounts.length === 0 && (
                            <option disabled>No accounts - please create one first</option>
                          )}
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name} - {formatCurrency(account.balance, account.currency)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Amount */}
                    <div className="sm:col-span-1">
                      <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2">
                        Amount *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2.5 md:py-3 text-sm md:text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent touch-target"
                        placeholder="0.00"
                      />
                    </div>

                    {/* Exchange Rate */}
                    {needsExchangeRate() && (
                      <div className="sm:col-span-1">
                        <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2">
                          Rate *
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          required
                          value={formData.exchangeRate}
                          onChange={(e) => setFormData({ ...formData, exchangeRate: parseFloat(e.target.value) || 1 })}
                          className="w-full px-3 py-2.5 md:py-3 text-sm md:text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent touch-target"
                          placeholder="1.0"
                        />
                      </div>
                    )}

                    {/* Date */}
                    <div className="sm:col-span-1">
                      <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2">
                        Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.transactionDate}
                        onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                        className="w-full px-3 py-2.5 md:py-3 text-sm md:text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent touch-target"
                      />
                    </div>

                    {/* Category */}
                    {formData.type !== "transfer" && (
                      <div className="sm:col-span-1">
                        <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2">
                          Category
                        </label>
                        {showCategoryInput ? (
                          <div className="flex gap-1 md:gap-2">
                            <input
                              type="text"
                              value={newCategory}
                              onChange={(e) => setNewCategory(e.target.value)}
                              onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCategory())}
                              placeholder="New category"
                              className="flex-1 px-3 py-2.5 md:py-3 text-sm md:text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={handleAddCategory}
                              className="px-3 md:px-4 py-2.5 md:py-3 bg-green-600 text-white rounded-lg text-sm md:text-base touch-target"
                            >
                              <FaCheck />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowCategoryInput(false);
                                setNewCategory("");
                              }}
                              className="px-3 md:px-4 py-2.5 md:py-3 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm md:text-base touch-target"
                            >
                              <FaTimes />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1 md:gap-2">
                            <select
                              value={formData.category}
                              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                              className="flex-1 px-3 py-2.5 md:py-3 text-sm md:text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            >
                              <option value="">Select</option>
                              {getCurrentCategories().map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setShowCategoryInput(true)}
                              className="px-3 md:px-4 py-2.5 md:py-3 bg-blue-600 text-white rounded-lg text-sm md:text-base touch-target"
                              title="Add new category"
                            >
                              <FaPlus />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2">
                      Description *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2.5 md:py-3 text-sm md:text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent touch-target"
                      placeholder="e.g., Grocery shopping"
                    />
                  </div>

                  {/* Need/Want (only for expenses) */}
                  {formData.type === "expense" && (
                    <div>
                      <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2">
                        Need or Want?
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, isNeed: true })}
                          className={`px-3 py-2 md:py-2.5 text-sm md:text-base rounded-lg transition-colors touch-target ${
                            formData.isNeed
                              ? "bg-orange-600 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          Need
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, isNeed: false })}
                          className={`px-3 py-2 md:py-2.5 text-sm md:text-base rounded-lg transition-colors touch-target ${
                            !formData.isNeed
                              ? "bg-purple-600 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          Want
                        </button>
                      </div>
                    </div>
                  )}

                  {/* People & Places in compact format */}
                  {(contacts.length > 0 || places.length > 0) && (
                    <details className="border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                      <summary className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                        Add People or Places (Optional)
                      </summary>
                      <div className="mt-2 space-y-2">
                        {contacts.length > 0 && (
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                              People
                            </label>
                            <select
                              multiple
                              value={formData.contactIds.map(String)}
                              onChange={(e) => {
                                const selectedOptions = Array.from(e.target.selectedOptions);
                                setFormData({
                                  ...formData,
                                  contactIds: selectedOptions.map(option => parseInt(option.value)),
                                });
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              size={3}
                            >
                              {contacts.map((contact) => (
                                <option key={contact.id} value={contact.id}>
                                  {contact.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {places.length > 0 && (
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                              Places
                            </label>
                            <select
                              multiple
                              value={formData.placeIds.map(String)}
                              onChange={(e) => {
                                const selectedOptions = Array.from(e.target.selectedOptions);
                                setFormData({
                                  ...formData,
                                  placeIds: selectedOptions.map(option => parseInt(option.value)),
                                });
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              size={3}
                            >
                              {places.map((place) => (
                                <option key={place.id} value={place.id}>
                                  {place.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </details>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-2 md:gap-3 pt-2 md:pt-4">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCloseModal}
                      className="flex-1 px-4 md:px-6 py-2.5 md:py-3 text-sm md:text-base border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium touch-target"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 px-4 md:px-6 py-2.5 md:py-3 text-sm md:text-base bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 touch-target"
                    >
                      <FaCheck />
                      {editingTransaction ? "Update" : "Create"}
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

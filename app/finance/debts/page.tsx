"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaTimes, FaCheck, FaHandHoldingUsd, FaExclamationTriangle } from "react-icons/fa";
import axios from "axios";
import FinanceSubmenu from "../(components)/FinanceSubmenu";

interface Contact {
  id: number;
  name: string;
  email?: string;
  phoneNumber?: string;
}

interface Debt {
  id: number;
  name: string;
  type: string;
  amount: number;
  remainingAmount: number;
  currency: string;
  interestRate?: number;
  contactId?: number;
  contact?: Contact;
  description?: string;
  dueDate?: string;
  startDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

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

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const contactDropdownRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "debt",
    amount: 0,
    remainingAmount: 0,
    currency: "USD",
    interestRate: 0,
    contactId: "",
    description: "",
    dueDate: "",
    startDate: new Date().toISOString().split('T')[0],
    status: "active",
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
        setShowContactDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchData = async () => {
    try {
      const baseUrl = window.location.origin;

      const [debtsRes, contactsRes] = await Promise.all([
        axios.get(`${baseUrl}/api/finance/debts`),
        axios.get(`${baseUrl}/api/contacts`),
      ]);

      setDebts(debtsRes.data.data || []);
      setContacts(contactsRes.data.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (debt?: Debt) => {
    if (debt) {
      setEditingDebt(debt);
      setFormData({
        name: debt.name,
        type: debt.type,
        amount: debt.amount,
        remainingAmount: debt.remainingAmount,
        currency: debt.currency,
        interestRate: debt.interestRate || 0,
        contactId: debt.contactId?.toString() || "",
        description: debt.description || "",
        dueDate: debt.dueDate ? debt.dueDate.split('T')[0] : "",
        startDate: debt.startDate.split('T')[0],
        status: debt.status,
      });
      // Set contact search to the contact name if exists
      if (debt.contact) {
        setContactSearch(debt.contact.name);
      } else {
        setContactSearch("");
      }
    } else {
      setEditingDebt(null);
      setFormData({
        name: "",
        type: "debt",
        amount: 0,
        remainingAmount: 0,
        currency: "USD",
        interestRate: 0,
        contactId: "",
        description: "",
        dueDate: "",
        startDate: new Date().toISOString().split('T')[0],
        status: "active",
      });
      setContactSearch("");
    }
    setShowContactDropdown(false);
    setIsModalOpen(true);
  };

  const handleContactSelect = (contact: Contact) => {
    setFormData({ ...formData, contactId: contact.id.toString() });
    setContactSearch(contact.name);
    setShowContactDropdown(false);
  };

  const handleClearContact = () => {
    setFormData({ ...formData, contactId: "" });
    setContactSearch("");
    setShowContactDropdown(false);
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDebt(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseUrl = window.location.origin;

      const payload = {
        ...formData,
        contactId: formData.contactId ? parseInt(formData.contactId) : null,
      };

      if (editingDebt) {
        await axios.put(`${baseUrl}/api/finance/debts`, {
          id: editingDebt.id,
          ...payload,
        });
      } else {
        await axios.post(`${baseUrl}/api/finance/debts`, payload);
      }

      fetchData();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving debt:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this debt/loan?")) {
      return;
    }

    try {
      const baseUrl = window.location.origin;
      await axios.delete(`${baseUrl}/api/finance/debts?id=${id}`);
      fetchDebts();
    } catch (error) {
      console.error("Error deleting debt:", error);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const getProgressPercentage = (remaining: number, total: number) => {
    return ((total - remaining) / total) * 100;
  };

  const activeDebts = debts.filter(d => d.type === "debt" && d.status === "active");
  const activeLoans = debts.filter(d => d.type === "loan" && d.status === "active");
  const paidDebts = debts.filter(d => d.status === "paid");

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <FinanceSubmenu />
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-600 dark:text-gray-400">Loading debts...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <FinanceSubmenu />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Debts & Loans
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Track money you owe and money owed to you
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenModal()}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-lg flex items-center gap-2"
          >
            <FaPlus />
            Add Debt/Loan
          </motion.button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
            <h3 className="text-sm font-medium opacity-90 mb-2">Total Debts (You Owe)</h3>
            <p className="text-3xl font-bold">
              {formatCurrency(
                activeDebts.reduce((sum, d) => sum + d.remainingAmount, 0),
                "USD"
              )}
            </p>
            <p className="text-sm opacity-75 mt-2">{activeDebts.length} active debts</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <h3 className="text-sm font-medium opacity-90 mb-2">Total Loans (Owed to You)</h3>
            <p className="text-3xl font-bold">
              {formatCurrency(
                activeLoans.reduce((sum, d) => sum + d.remainingAmount, 0),
                "USD"
              )}
            </p>
            <p className="text-sm opacity-75 mt-2">{activeLoans.length} active loans</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <h3 className="text-sm font-medium opacity-90 mb-2">Completed</h3>
            <p className="text-3xl font-bold">{paidDebts.length}</p>
            <p className="text-sm opacity-75 mt-2">Paid off debts/loans</p>
          </div>
        </div>

        {/* Debts & Loans List */}
        <div className="space-y-6">
          {/* Active Debts */}
          {activeDebts.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FaExclamationTriangle className="text-red-500" />
                Active Debts (You Owe)
              </h3>
              <div className="space-y-4">
                {activeDebts.map((debt) => (
                  <motion.div
                    key={debt.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-900/30 p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                          {debt.name}
                        </h4>
                        {debt.contact && (
                          <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                            👤 {debt.contact.name}
                          </p>
                        )}
                        {debt.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {debt.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <div>
                            <span className="font-medium">Original:</span>{" "}
                            {formatCurrency(debt.amount, debt.currency)}
                          </div>
                          <div>
                            <span className="font-medium">Remaining:</span>{" "}
                            <span className="text-red-600 dark:text-red-400 font-bold">
                              {formatCurrency(debt.remainingAmount, debt.currency)}
                            </span>
                          </div>
                          {debt.interestRate && debt.interestRate > 0 && (
                            <div>
                              <span className="font-medium">Interest:</span> {debt.interestRate}%
                            </div>
                          )}
                          {debt.dueDate && (
                            <div>
                              <span className="font-medium">Due:</span>{" "}
                              {new Date(debt.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleOpenModal(debt)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                        >
                          <FaEdit />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDelete(debt.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                        >
                          <FaTrash />
                        </motion.button>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{getProgressPercentage(debt.remainingAmount, debt.amount).toFixed(0)}% paid</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-red-600 h-2 rounded-full transition-all"
                          style={{ width: `${getProgressPercentage(debt.remainingAmount, debt.amount)}%` }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Active Loans */}
          {activeLoans.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FaHandHoldingUsd className="text-green-500" />
                Active Loans (Owed to You)
              </h3>
              <div className="space-y-4">
                {activeLoans.map((debt) => (
                  <motion.div
                    key={debt.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-green-200 dark:border-green-900/30 p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                          {debt.name}
                        </h4>
                        {debt.contact && (
                          <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                            👤 {debt.contact.name}
                          </p>
                        )}
                        {debt.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {debt.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <div>
                            <span className="font-medium">Original:</span>{" "}
                            {formatCurrency(debt.amount, debt.currency)}
                          </div>
                          <div>
                            <span className="font-medium">Remaining:</span>{" "}
                            <span className="text-green-600 dark:text-green-400 font-bold">
                              {formatCurrency(debt.remainingAmount, debt.currency)}
                            </span>
                          </div>
                          {debt.interestRate && debt.interestRate > 0 && (
                            <div>
                              <span className="font-medium">Interest:</span> {debt.interestRate}%
                            </div>
                          )}
                          {debt.dueDate && (
                            <div>
                              <span className="font-medium">Due:</span>{" "}
                              {new Date(debt.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleOpenModal(debt)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                        >
                          <FaEdit />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDelete(debt.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                        >
                          <FaTrash />
                        </motion.button>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{getProgressPercentage(debt.remainingAmount, debt.amount).toFixed(0)}% received</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${getProgressPercentage(debt.remainingAmount, debt.amount)}%` }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {activeDebts.length === 0 && activeLoans.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12">
              <div className="text-center">
                <FaHandHoldingUsd className="mx-auto text-6xl text-gray-300 dark:text-gray-600 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  No Active Debts or Loans
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Start tracking your debts and loans
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleOpenModal()}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-lg inline-flex items-center gap-2"
                >
                  <FaPlus />
                  Add Your First Entry
                </motion.button>
              </div>
            </div>
          )}
        </div>

        {/* Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full p-6 z-10 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {editingDebt ? "Edit Debt/Loan" : "Add Debt/Loan"}
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <FaTimes />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Type *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: "debt" })}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          formData.type === "debt"
                            ? "bg-red-600 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        Debt (You Owe)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: "loan" })}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          formData.type === "loan"
                            ? "bg-green-600 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        Loan (Owed to You)
                      </button>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="e.g., Credit Card Debt"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Original Amount *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>

                    {/* Remaining Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Remaining Amount *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.remainingAmount}
                        onChange={(e) => setFormData({ ...formData, remainingAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="0.00"
                      />
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

                    {/* Interest Rate */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Interest Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.interestRate}
                        onChange={(e) => setFormData({ ...formData, interestRate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>

                    {/* Contact/Person - Searchable */}
                    <div className="relative" ref={contactDropdownRef}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Person (Optional)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={contactSearch}
                          onChange={(e) => {
                            setContactSearch(e.target.value);
                            setShowContactDropdown(true);
                            if (!e.target.value) {
                              setFormData({ ...formData, contactId: "" });
                            }
                          }}
                          onFocus={() => setShowContactDropdown(true)}
                          placeholder="Search or select person..."
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        {formData.contactId && (
                          <button
                            type="button"
                            onClick={handleClearContact}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          >
                            <FaTimes />
                          </button>
                        )}
                      </div>

                      {/* Dropdown */}
                      {showContactDropdown && filteredContacts.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredContacts.map((contact) => (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() => handleContactSelect(contact)}
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white flex items-center gap-2"
                            >
                              <span className="text-blue-600 dark:text-blue-400">👤</span>
                              <div className="flex-1">
                                <div className="font-medium">{contact.name}</div>
                                {contact.email && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {contact.email}
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {showContactDropdown && contactSearch && filteredContacts.length === 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 text-center text-gray-500 dark:text-gray-400">
                          No contacts found
                        </div>
                      )}
                    </div>

                    {/* Start Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>

                    {/* Due Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Due Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Status
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {["active", "paid", "overdue"].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setFormData({ ...formData, status })}
                          className={`px-3 py-2 rounded-lg capitalize text-sm transition-colors ${
                            formData.status === status
                              ? "bg-green-600 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
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
                      placeholder="Add notes..."
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
                      {editingDebt ? "Update" : "Create"}
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

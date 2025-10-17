"use client";
import axios from "axios";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { FaSync, FaTrash, FaUser, FaPhone, FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import DeleteDialog from "../(components)/DeleteDialog";
import Snackbar from "../(components)/Snackbar";

interface Contact {
  id: number;
  userId: string;
  googleId?: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  photoUrl?: string;
  organization?: string;
  jobTitle?: string;
  notes?: string;
  address?: string;
  birthday?: string;
  weddingAnniversary?: string;
  lastSynced: string;
  createdAt: string;
  updatedAt: string;
}

type SortField = 'name' | 'phoneNumber' | 'address' | 'birthday' | 'weddingAnniversary';
type SortDirection = 'asc' | 'desc' | null;

export default function People() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const baseUrl = window.location.origin;
    try {
      const response = await axios.get(`${baseUrl}/api/contacts`);
      setContacts(response.data.data);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      setSnackbar({ message: "Failed to load contacts", type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSyncContacts = useCallback(async () => {
    setSyncing(true);
    const baseUrl = window.location.origin;
    try {
      const response = await axios.post(`${baseUrl}/api/contacts/sync`);
      setSnackbar({
        message: `Successfully synced ${response.data.count} contacts from Google`,
        type: 'success'
      });
      setTimeout(() => setSnackbar(null), 3000);
      fetchContacts();
    } catch (error: unknown) {
      console.error("Error syncing contacts:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to sync contacts";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    } finally {
      setSyncing(false);
    }
  }, [fetchContacts]);

  const handleDelete = useCallback((id: number) => {
    setDeleteConfirmId(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    const contact = contacts.find(c => c.id === deleteConfirmId);
    const baseUrl = window.location.origin;
    try {
      await axios.delete(`${baseUrl}/api/contacts`, {
        data: { id: deleteConfirmId }
      });
      setDeleteConfirmId(null);
      fetchContacts();
      setSnackbar({ message: `"${contact?.name}" deleted successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error: unknown) {
      console.error("Error deleting contact:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to delete contact";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [deleteConfirmId, contacts, fetchContacts]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Toggle direction: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      // New field, start with ascending
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <FaSort className="ml-1 text-gray-400" />;
    }
    if (sortDirection === 'asc') {
      return <FaSortUp className="ml-1 text-blue-600 dark:text-blue-400" />;
    }
    if (sortDirection === 'desc') {
      return <FaSortDown className="ml-1 text-blue-600 dark:text-blue-400" />;
    }
    return <FaSort className="ml-1 text-gray-400" />;
  };

  // Sort contacts
  const sortedContacts = useCallback(() => {
    if (!sortField || !sortDirection) {
      return contacts;
    }

    return [...contacts].sort((a, b) => {
      let aValue: string | number | null = null;
      let bValue: string | number | null = null;

      switch (sortField) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'phoneNumber':
          aValue = a.phoneNumber?.toLowerCase() || '';
          bValue = b.phoneNumber?.toLowerCase() || '';
          break;
        case 'address':
          aValue = a.address?.toLowerCase() || '';
          bValue = b.address?.toLowerCase() || '';
          break;
        case 'birthday':
          aValue = a.birthday ? new Date(a.birthday).getTime() : 0;
          bValue = b.birthday ? new Date(b.birthday).getTime() : 0;
          break;
        case 'weddingAnniversary':
          aValue = a.weddingAnniversary ? new Date(a.weddingAnniversary).getTime() : 0;
          bValue = b.weddingAnniversary ? new Date(b.weddingAnniversary).getTime() : 0;
          break;
      }

      if (aValue === null || aValue === '' || aValue === 0) return 1;
      if (bValue === null || bValue === '' || bValue === 0) return -1;

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [contacts, sortField, sortDirection]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-2">
              People
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your contacts
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSyncContacts}
            disabled={syncing}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaSync className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Contacts"}
          </motion.button>
        </motion.div>

        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-32"
          >
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">Loading contacts...</p>
            </div>
          </motion.div>
        ) : contacts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              No contacts yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Click the &quot;Sync Contacts&quot; button to import your Google contacts
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Name
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
                      onClick={() => handleSort('phoneNumber')}
                    >
                      <div className="flex items-center">
                        Phone
                        {getSortIcon('phoneNumber')}
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
                      onClick={() => handleSort('address')}
                    >
                      <div className="flex items-center">
                        Address
                        {getSortIcon('address')}
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
                      onClick={() => handleSort('birthday')}
                    >
                      <div className="flex items-center">
                        Birthday
                        {getSortIcon('birthday')}
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
                      onClick={() => handleSort('weddingAnniversary')}
                    >
                      <div className="flex items-center">
                        Anniversary
                        {getSortIcon('weddingAnniversary')}
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedContacts().map((contact: Contact, index: number) => (
                    <motion.tr
                      key={contact.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {contact.photoUrl ? (
                            <img
                              src={contact.photoUrl}
                              alt={contact.name}
                              className="w-10 h-10 rounded-full object-cover mr-3 border border-gray-200 dark:border-gray-700"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-3">
                              <FaUser className="text-white text-sm" />
                            </div>
                          )}
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {contact.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {contact.phoneNumber ? (
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <FaPhone className="mr-2 text-green-500" />
                            {contact.phoneNumber}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {contact.address ? (
                          <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={contact.address}>
                            {contact.address}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {contact.birthday ? (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(contact.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {contact.weddingAnniversary ? (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(contact.weddingAnniversary).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDelete(contact.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete contact"
                        >
                          <FaTrash />
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      <DeleteDialog
        isOpen={deleteConfirmId !== null}
        title="Delete Contact?"
        itemName={contacts.find(c => c.id === deleteConfirmId)?.name}
        onConfirmAction={confirmDelete}
        onCancelAction={cancelDelete}
      />

      <Snackbar
        message={snackbar?.message || ""}
        type={snackbar?.type || 'info'}
        isOpen={!!snackbar}
        onCloseAction={() => setSnackbar(null)}
      />
    </div>
  );
}

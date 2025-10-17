"use client";
import axios from "axios";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { FaSync, FaTrash, FaUser, FaEnvelope, FaPhone, FaBriefcase } from "react-icons/fa";
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
  lastSynced: string;
  createdAt: string;
  updatedAt: string;
}

export default function People() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

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
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {contacts.map((contact: Contact, index: number) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative group"
              >
                <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col items-center mb-4">
                    {contact.photoUrl ? (
                      <img
                        src={contact.photoUrl}
                        alt={contact.name}
                        className="w-20 h-20 rounded-full object-cover mb-3 border-2 border-gray-200 dark:border-gray-700"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-3">
                        <FaUser className="text-white text-3xl" />
                      </div>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
                      {contact.name}
                    </h3>
                  </div>

                  <div className="space-y-2 mb-4">
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <FaEnvelope className="flex-shrink-0 text-blue-500" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.phoneNumber && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <FaPhone className="flex-shrink-0 text-green-500" />
                        <span className="truncate">{contact.phoneNumber}</span>
                      </div>
                    )}
                    {contact.organization && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <FaBriefcase className="flex-shrink-0 text-purple-500" />
                        <div className="min-w-0">
                          <div className="truncate">{contact.organization}</div>
                          {contact.jobTitle && (
                            <div className="truncate text-xs text-gray-500 dark:text-gray-500">
                              {contact.jobTitle}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDelete(contact.id)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete contact"
                    >
                      <FaTrash />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
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

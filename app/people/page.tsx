"use client";
import axios from "axios";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { FaSync, FaTrash, FaUser, FaPhone, FaSort, FaSortUp, FaSortDown, FaPlus, FaEdit, FaCheck, FaTimes, FaSearch, FaInfoCircle, FaUndo, FaArchive } from "react-icons/fa";
import DeleteDialog from "../(components)/DeleteDialog";
import Snackbar from "../(components)/Snackbar";
import { Dialog, DialogContent, DialogTitle, TextField, Button } from "@mui/material";

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

interface IgnoredContact {
  id: number;
  userId: string;
  googleId: string;
  name?: string;
  createdAt: string;
}

type SortField = 'name' | 'birthday' | 'weddingAnniversary';
type SortDirection = 'asc' | 'desc' | null;

export default function People() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [showAddDialog, setShowAddDialog] = useState<boolean>(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [formData, setFormData] = useState<Partial<Contact>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [isEditingDetail, setIsEditingDetail] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [offset, setOffset] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [archivedContacts, setArchivedContacts] = useState<IgnoredContact[]>([]);
  const [archivedHasMore, setArchivedHasMore] = useState<boolean>(true);
  const [archivedOffset, setArchivedOffset] = useState<number>(0);
  const [archivedTotalCount, setArchivedTotalCount] = useState<number>(0);

  const fetchContacts = useCallback(async (reset = true, search = '') => {
    if (reset) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    const baseUrl = window.location.origin;
    const currentOffset = reset ? 0 : offset;
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';

    try {
      const response = await axios.get(`${baseUrl}/api/contacts?limit=50&offset=${currentOffset}${searchParam}`);
      const newContacts = response.data.data;
      const pagination = response.data.pagination;

      if (reset) {
        setContacts(newContacts);
      } else {
        // Deduplicate contacts by ID before adding
        setContacts(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const uniqueNewContacts = newContacts.filter((c: Contact) => !existingIds.has(c.id));
          return [...prev, ...uniqueNewContacts];
        });
      }

      setTotalCount(pagination.total);
      setHasMore(pagination.hasMore);
      setOffset(currentOffset + newContacts.length);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      setSnackbar({ message: "Failed to load contacts", type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [offset]);

  const loadMoreContacts = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchContacts(false, searchQuery);
    }
  }, [loadingMore, hasMore, searchQuery, fetchContacts]);

  const fetchArchivedContacts = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      setArchivedOffset(0);
    } else {
      setLoadingMore(true);
    }

    const baseUrl = window.location.origin;
    const currentOffset = reset ? 0 : archivedOffset;

    try {
      const response = await axios.get(`${baseUrl}/api/contacts/ignored?limit=50&offset=${currentOffset}`);
      const newContacts = response.data.data;
      const pagination = response.data.pagination;

      if (reset) {
        setArchivedContacts(newContacts);
      } else {
        // Deduplicate contacts by ID before adding
        setArchivedContacts(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const uniqueNewContacts = newContacts.filter((c: IgnoredContact) => !existingIds.has(c.id));
          return [...prev, ...uniqueNewContacts];
        });
      }

      setArchivedTotalCount(pagination.total);
      setArchivedHasMore(pagination.hasMore);
      setArchivedOffset(currentOffset + newContacts.length);
    } catch (error) {
      console.error("Error fetching archived contacts:", error);
      setSnackbar({ message: "Failed to load archived contacts", type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [archivedOffset]);

  const handleRestoreContact = useCallback(async (googleId: string, name?: string) => {
    const baseUrl = window.location.origin;
    try {
      await axios.delete(`${baseUrl}/api/contacts/ignored`, {
        data: { googleId }
      });
      fetchArchivedContacts(true);
      setSnackbar({ message: `"${name || 'Contact'}" restored - will reappear on next sync`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error: unknown) {
      console.error("Error restoring contact:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to restore contact";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [fetchArchivedContacts]);

  useEffect(() => {
    if (viewMode === 'active') {
      fetchContacts(true, searchQuery);
    } else {
      fetchArchivedContacts(true);
    }
  }, [viewMode, searchQuery]);

  const handleSyncContacts = useCallback(async () => {
    setSyncing(true);
    const baseUrl = window.location.origin;
    try {
      const response = await axios.post(`${baseUrl}/api/contacts/sync`);
      const { count, skipped, total } = response.data;
      let message = `Successfully synced ${count} contacts from Google`;
      if (skipped > 0) {
        message += ` (${skipped} ignored, ${total} total from Google)`;
      }
      setSnackbar({
        message,
        type: 'success'
      });
      setTimeout(() => setSnackbar(null), 5000);
      fetchContacts(true);
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
      fetchContacts(true);
      setSnackbar({ message: `"${contact?.name}" deleted successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error: unknown) {
      console.error("Error deleting contact:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to delete contact";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [deleteConfirmId, contacts, fetchContacts]);

  const handleBulkDelete = useCallback(async () => {
    const baseUrl = window.location.origin;
    try {
      await axios.delete(`${baseUrl}/api/contacts/bulk`, {
        data: { ids: selectedContacts }
      });
      setShowBulkDeleteConfirm(false);
      setSelectedContacts([]);
      fetchContacts(true);
      setSnackbar({ message: `${selectedContacts.length} contacts deleted successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error: unknown) {
      console.error("Error deleting contacts:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to delete contacts";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [selectedContacts, fetchContacts]);

  const handleEdit = useCallback((contact: Contact) => {
    setEditContact(contact);
    setFormData(contact);
  }, []);

  const handleAdd = useCallback(() => {
    setShowAddDialog(true);
    setFormData({
      name: '',
      email: '',
      phoneNumber: '',
      address: '',
      birthday: '',
      weddingAnniversary: '',
      notes: ''
    });
  }, []);

  const handleSaveContact = useCallback(async () => {
    const baseUrl = window.location.origin;
    try {
      if (editContact) {
        // Update existing contact
        await axios.put(`${baseUrl}/api/contacts`, {
          id: editContact.id,
          ...formData
        });
        setSnackbar({ message: "Contact updated successfully", type: 'success' });
      } else {
        // Create new contact
        await axios.post(`${baseUrl}/api/contacts`, formData);
        setSnackbar({ message: "Contact added successfully", type: 'success' });
      }
      setTimeout(() => setSnackbar(null), 3000);
      setEditContact(null);
      setShowAddDialog(false);
      fetchContacts(true);
    } catch (error: unknown) {
      console.error("Error saving contact:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to save contact";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [editContact, formData, fetchContacts]);

  const handleSaveDetailContact = useCallback(async () => {
    if (!detailContact) return;
    const baseUrl = window.location.origin;
    try {
      await axios.put(`${baseUrl}/api/contacts`, {
        id: detailContact.id,
        ...formData
      });
      setSnackbar({ message: "Contact updated successfully", type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
      setDetailContact({ ...detailContact, ...formData } as Contact);
      setIsEditingDetail(false);
      fetchContacts(true);
    } catch (error: unknown) {
      console.error("Error saving contact:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to save contact";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [detailContact, formData, fetchContacts]);

  const toggleSelectContact = useCallback((id: number) => {
    setSelectedContacts(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  }, [selectedContacts, contacts]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
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

  const filteredAndSortedContacts = useCallback(() => {
    // Sorting only (filtering is done on backend)
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
          className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-2">
              People
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your contacts • Total: {viewMode === 'active' ? totalCount : archivedTotalCount} {((viewMode === 'active' && totalCount > 0) || (viewMode === 'archived' && archivedTotalCount > 0)) && `(Showing ${viewMode === 'active' ? contacts.length : archivedContacts.length})`}
            </p>
          </div>

          {/* Search Bar - Only for active contacts */}
          {viewMode === 'active' && (
            <div className="w-full sm:w-auto flex-grow sm:flex-grow-0 sm:min-w-[300px]">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            {viewMode === 'active' && selectedContacts.length > 0 && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-lg transition-all"
              >
                <FaTrash />
                Delete ({selectedContacts.length})
              </motion.button>
            )}

            {viewMode === 'active' && (
              <>
                <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-lg transition-all"
            >
              <FaPlus />
              Add Contact
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSyncContacts}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaSync className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync Google"}
            </motion.button>
              </>
            )}

            {/* Archive Link - Subtle */}
            <button
              onClick={() => setViewMode(viewMode === 'active' ? 'archived' : 'active')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
            >
              <FaArchive className="text-xs" />
              <span>{viewMode === 'archived' ? 'Back to Contacts' : 'Archived'}</span>
              {archivedTotalCount > 0 && viewMode === 'active' && (
                <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                  {archivedTotalCount}
                </span>
              )}
            </button>
          </div>
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
        ) : viewMode === 'archived' ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700"
          >
            <div>
              <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Google ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Archived Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {archivedContacts.map((contact: IgnoredContact, index: number) => (
                    <motion.tr
                      key={contact.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {contact.name || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-400 font-mono text-xs">
                          {contact.googleId}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(contact.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleRestoreContact(contact.googleId, contact.name)}
                          className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Restore contact"
                        >
                          <FaUndo />
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Loading More Indicator */}
            {loadingMore && (
              <div className="flex justify-center items-center py-4">
                <div className="w-8 h-8 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading more contacts...</span>
              </div>
            )}

            {/* End of List Indicator */}
            {!archivedHasMore && archivedContacts.length > 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                All archived contacts loaded ({archivedTotalCount} total)
              </div>
            )}

            {/* Empty State */}
            {archivedContacts.length === 0 && !loading && (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  No archived contacts
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Contacts you delete will appear here
                </p>
              </div>
            )}
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
              Click &quot;Sync Google&quot; to import from Google or &quot;Add Contact&quot; to create one manually
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700"
          >
            <div>
              <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedContacts.length === contacts.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </th>
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
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {(() => {
                    const displayedContacts = filteredAndSortedContacts();
                    return displayedContacts.map((contact: Contact, index: number) => {
                      return (
                        <motion.tr
                          key={contact.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedContacts.includes(contact.id)}
                          onChange={() => toggleSelectContact(contact.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                      </td>
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
                          <button
                            onClick={() => setDetailContact(contact)}
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            {contact.name}
                          </button>
                        </div>
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
                    </motion.tr>
                  );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center items-center py-6 border-t border-gray-200 dark:border-gray-700">
                <motion.button
                  whileHover={!loadingMore ? { scale: 1.05 } : {}}
                  whileTap={!loadingMore ? { scale: 0.95 } : {}}
                  onClick={loadMoreContacts}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loadingMore ? (
                    <>
                      <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      Load More ({totalCount - contacts.length} remaining)
                    </>
                  )}
                </motion.button>
              </div>
            )}

            {/* End of List Indicator */}
            {!hasMore && contacts.length > 0 && (
              <div className="text-center py-4 border-t border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm">
                {searchQuery ? `All matching contacts loaded (${totalCount} found)` : `All contacts loaded (${totalCount} total)`}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Edit/Add Contact Dialog */}
      <Dialog
        open={editContact !== null || showAddDialog}
        onClose={() => {
          setEditContact(null);
          setShowAddDialog(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editContact ? 'Edit Contact' : 'Add Contact'}
        </DialogTitle>
        <DialogContent>
          <div className="space-y-4 mt-4">
            <TextField
              fullWidth
              label="Name *"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <TextField
              fullWidth
              label="Phone Number"
              value={formData.phoneNumber || ''}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            />
            <TextField
              fullWidth
              label="Address"
              multiline
              rows={2}
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
            <TextField
              fullWidth
              label="Birthday"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={formData.birthday ? new Date(formData.birthday).toISOString().split('T')[0] : ''}
              onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
            />
            <TextField
              fullWidth
              label="Wedding Anniversary"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={formData.weddingAnniversary ? new Date(formData.weddingAnniversary).toISOString().split('T')[0] : ''}
              onChange={(e) => setFormData({ ...formData, weddingAnniversary: e.target.value })}
            />
            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
            <div className="flex gap-2 justify-end pt-4">
              <Button
                onClick={() => {
                  setEditContact(null);
                  setShowAddDialog(false);
                }}
                startIcon={<FaTimes />}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveContact}
                disabled={!formData.name}
                startIcon={<FaCheck />}
              >
                {editContact ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <DeleteDialog
        isOpen={deleteConfirmId !== null}
        title="Delete Contact?"
        itemName={contacts.find(c => c.id === deleteConfirmId)?.name}
        onConfirmAction={confirmDelete}
        onCancelAction={cancelDelete}
      />

      {/* Bulk Delete Dialog */}
      <DeleteDialog
        isOpen={showBulkDeleteConfirm}
        title={`Delete ${selectedContacts.length} Contacts?`}
        itemName={`${selectedContacts.length} selected contacts`}
        onConfirmAction={handleBulkDelete}
        onCancelAction={() => setShowBulkDeleteConfirm(false)}
      />

      {/* Contact Detail/Edit Dialog */}
      <Dialog
        open={detailContact !== null}
        onClose={() => {
          setDetailContact(null);
          setIsEditingDetail(false);
          setFormData({});
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {detailContact?.photoUrl ? (
                <img
                  src={detailContact.photoUrl}
                  alt={detailContact.name}
                  className="w-16 h-16 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <FaUser className="text-white text-xl" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold">{detailContact?.name}</h2>
                {detailContact?.jobTitle && detailContact?.organization && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {detailContact.jobTitle} at {detailContact.organization}
                  </p>
                )}
              </div>
            </div>
            {!isEditingDetail && (
              <Button
                startIcon={<FaEdit />}
                onClick={() => {
                  setIsEditingDetail(true);
                  setFormData(detailContact || {});
                }}
              >
                Edit
              </Button>
            )}
          </div>
        </DialogTitle>
        <DialogContent>
          <div className="space-y-4 mt-4">
            {isEditingDetail ? (
              <>
                <TextField
                  fullWidth
                  label="Name *"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={formData.phoneNumber || ''}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Address"
                  multiline
                  rows={2}
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Organization"
                  value={formData.organization || ''}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Job Title"
                  value={formData.jobTitle || ''}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Birthday"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={formData.birthday ? new Date(formData.birthday).toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Wedding Anniversary"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={formData.weddingAnniversary ? new Date(formData.weddingAnniversary).toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, weddingAnniversary: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
                <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    onClick={() => {
                      setIsEditingDetail(false);
                      setFormData({});
                    }}
                    startIcon={<FaTimes />}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSaveDetailContact}
                    disabled={!formData.name}
                    startIcon={<FaCheck />}
                  >
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <>
                {detailContact?.email && (
                  <div className="flex items-start gap-3">
                    <FaInfoCircle className="text-blue-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
                      <p className="text-base text-gray-900 dark:text-white">{detailContact.email}</p>
                    </div>
                  </div>
                )}

                {detailContact?.phoneNumber && (
                  <div className="flex items-start gap-3">
                    <FaPhone className="text-green-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</p>
                      <p className="text-base text-gray-900 dark:text-white">{detailContact.phoneNumber}</p>
                    </div>
                  </div>
                )}

                {detailContact?.address && (
                  <div className="flex items-start gap-3">
                    <FaInfoCircle className="text-purple-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</p>
                      <p className="text-base text-gray-900 dark:text-white">{detailContact.address}</p>
                    </div>
                  </div>
                )}

                {detailContact?.organization && (
                  <div className="flex items-start gap-3">
                    <FaInfoCircle className="text-orange-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Organization</p>
                      <p className="text-base text-gray-900 dark:text-white">{detailContact.organization}</p>
                    </div>
                  </div>
                )}

                {detailContact?.jobTitle && (
                  <div className="flex items-start gap-3">
                    <FaInfoCircle className="text-teal-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Job Title</p>
                      <p className="text-base text-gray-900 dark:text-white">{detailContact.jobTitle}</p>
                    </div>
                  </div>
                )}

                {detailContact?.birthday && (
                  <div className="flex items-start gap-3">
                    <FaInfoCircle className="text-pink-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Birthday</p>
                      <p className="text-base text-gray-900 dark:text-white">
                        {new Date(detailContact.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}

                {detailContact?.weddingAnniversary && (
                  <div className="flex items-start gap-3">
                    <FaInfoCircle className="text-red-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Wedding Anniversary</p>
                      <p className="text-base text-gray-900 dark:text-white">
                        {new Date(detailContact.weddingAnniversary).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}

                {detailContact?.notes && (
                  <div className="flex items-start gap-3">
                    <FaInfoCircle className="text-gray-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</p>
                      <p className="text-base text-gray-900 dark:text-white whitespace-pre-wrap">{detailContact.notes}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    startIcon={detailContact?.googleId ? <FaArchive /> : <FaTrash />}
                    color={detailContact?.googleId ? "warning" : "error"}
                    onClick={() => {
                      if (detailContact) {
                        handleDelete(detailContact.id);
                        setDetailContact(null);
                        setIsEditingDetail(false);
                      }
                    }}
                  >
                    {detailContact?.googleId ? 'Archive' : 'Delete'}
                  </Button>
                  <Button onClick={() => {
                    setDetailContact(null);
                    setIsEditingDetail(false);
                    setFormData({});
                  }}>
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        message={snackbar?.message || ""}
        type={snackbar?.type || 'info'}
        isOpen={!!snackbar}
        onCloseAction={() => setSnackbar(null)}
      />
    </div>
  );
}

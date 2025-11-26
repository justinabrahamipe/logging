"use client";
import axios from "axios";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {  FaTrash, FaPlus, FaCheck, FaTimes, FaSearch, FaMapMarkedAlt, FaTable, FaTh, FaEdit, FaMap, FaHome } from "react-icons/fa";
import DeleteDialog from "../(components)/DeleteDialog";
import Snackbar from "../(components)/Snackbar";
import AddressInput from "../(components)/AddressInput";
import { Dialog, DialogContent, DialogTitle, TextField, Button, MenuItem } from "@mui/material";

interface Place {
  id: number;
  userId: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = 'table' | 'cards' | 'map';

// Helper function to generate Google Maps URL
const getGoogleMapsUrl = (address: string, lat?: number, lon?: number) => {
  if (lat && lon) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
};

export default function Places() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [importing, setImporting] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [editPlace, setEditPlace] = useState<Place | null>(null);
  const [showAddDialog, setShowAddDialog] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [formData, setFormData] = useState<Partial<Place>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [offset, setOffset] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<number[]>([]);
  const [showDeleteSelected, setShowDeleteSelected] = useState<boolean>(false);

  const fetchPlaces = useCallback(async (reset = true, search = '', category = '') => {
    if (reset) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    const baseUrl = window.location.origin;
    const currentOffset = reset ? 0 : offset;
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const categoryParam = category ? `&category=${encodeURIComponent(category)}` : '';

    try {
      const response = await axios.get(`${baseUrl}/api/places?limit=50&offset=${currentOffset}${searchParam}${categoryParam}`);
      const newPlaces = response.data.data;
      const pagination = response.data.pagination;

      if (reset) {
        setPlaces(newPlaces);
      } else {
        setPlaces(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNewPlaces = newPlaces.filter((p: Place) => !existingIds.has(p.id));
          return [...prev, ...uniqueNewPlaces];
        });
      }

      setTotalCount(pagination.total);
      setHasMore(pagination.hasMore);
      setOffset(currentOffset + newPlaces.length);
    } catch (error) {
      console.error("Error fetching places:", error);
      setSnackbar({ message: "Failed to load places", type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [offset]);

  const loadMorePlaces = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchPlaces(false, searchQuery, categoryFilter);
    }
  }, [loadingMore, hasMore, searchQuery, categoryFilter, fetchPlaces]);

  useEffect(() => {
    fetchPlaces(true, searchQuery, categoryFilter);
  }, [searchQuery, categoryFilter]);

  const handleDelete = useCallback((id: number) => {
    setDeleteConfirmId(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    const place = places.find(p => p.id === deleteConfirmId);
    const baseUrl = window.location.origin;
    try {
      await axios.delete(`${baseUrl}/api/places`, {
        data: { id: deleteConfirmId }
      });
      setDeleteConfirmId(null);
      fetchPlaces(true, searchQuery, categoryFilter);
      setSnackbar({ message: `"${place?.name}" deleted successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error: unknown) {
      console.error("Error deleting place:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to delete place";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [deleteConfirmId, places, searchQuery, categoryFilter, fetchPlaces]);

  const handleEdit = useCallback((place: Place) => {
    setEditPlace(place);
    setFormData(place);
  }, []);

  const handleAdd = useCallback(() => {
    setShowAddDialog(true);
    setFormData({
      name: '',
      address: '',
      latitude: undefined,
      longitude: undefined,
      description: '',
      category: 'home'
    });
  }, []);

  const handleSavePlace = useCallback(async () => {
    const baseUrl = window.location.origin;
    try {
      if (editPlace) {
        // Update existing place
        await axios.put(`${baseUrl}/api/places`, {
          id: editPlace.id,
          ...formData
        });
        setSnackbar({ message: "Place updated successfully", type: 'success' });
      } else {
        // Create new place
        await axios.post(`${baseUrl}/api/places`, {
          ...formData
        });
        setSnackbar({ message: "Place added successfully", type: 'success' });
      }
      setTimeout(() => setSnackbar(null), 3000);
      setEditPlace(null);
      setShowAddDialog(false);
      fetchPlaces(true, searchQuery, categoryFilter);
    } catch (error: unknown) {
      console.error("Error saving place:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to save place";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [editPlace, formData, searchQuery, categoryFilter, fetchPlaces]);


  const handleImportPlaces = useCallback(async () => {
    setImporting(true);
    const baseUrl = window.location.origin;
    try {
      const response = await axios.post(`${baseUrl}/api/places/import-from-contacts`);
      const { message, created, skipped, totalContacts } = response.data;
      setSnackbar({
        message: message || `Created ${created} places from ${totalContacts} contacts${skipped > 0 ? ` (${skipped} skipped)` : ''}`,
        type: created > 0 ? 'success' : 'info'
      });
      setTimeout(() => setSnackbar(null), 5000);

      // Refresh places list
      fetchPlaces(true, searchQuery, categoryFilter);
    } catch (error: unknown) {
      console.error("Error importing places:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to import places from contacts";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    } finally {
      setImporting(false);
    }
  }, [searchQuery, categoryFilter, fetchPlaces]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  const handleToggleSelectPlace = useCallback((placeId: number) => {
    setSelectedPlaceIds(prev => {
      if (prev.includes(placeId)) {
        return prev.filter(id => id !== placeId);
      } else {
        return [...prev, placeId];
      }
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedPlaceIds.length === places.length) {
      setSelectedPlaceIds([]);
    } else {
      setSelectedPlaceIds(places.map(p => p.id));
    }
  }, [selectedPlaceIds, places]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedPlaceIds.length === 0) return;
    setShowDeleteSelected(true);
  }, [selectedPlaceIds]);

  const confirmDeleteSelected = useCallback(async () => {
    if (selectedPlaceIds.length === 0) return;
    const baseUrl = window.location.origin;
    try {
      const response = await axios.delete(`${baseUrl}/api/places`, {
        data: { ids: selectedPlaceIds }
      });
      setShowDeleteSelected(false);
      setSelectedPlaceIds([]);
      fetchPlaces(true, searchQuery, categoryFilter);
      setSnackbar({
        message: response.data.message || `Deleted ${selectedPlaceIds.length} place${selectedPlaceIds.length !== 1 ? 's' : ''}`,
        type: 'success'
      });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error: unknown) {
      console.error("Error deleting places:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to delete places";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [selectedPlaceIds, searchQuery, categoryFilter, fetchPlaces]);

  const cancelDeleteSelected = useCallback(() => {
    setShowDeleteSelected(false);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-2">
                Places
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your places • Total: {totalCount} {totalCount > 0 && `(Showing ${places.length})`}
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              {selectedPlaceIds.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-lg transition-all"
                >
                  <FaTrash />
                  Delete Selected ({selectedPlaceIds.length})
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleImportPlaces}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Create places from contacts with addresses"
              >
                <FaHome className={importing ? "animate-pulse" : ""} />
                {importing ? "Importing..." : "Import from Contacts"}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-lg transition-all"
              >
                <FaPlus />
                Add Place
              </motion.button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-grow w-full sm:w-auto">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search places..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">All Categories</option>
              <option value="home">Home</option>
              <option value="work">Work</option>
              <option value="visited">Visited</option>
              <option value="other">Other</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                title="Table View"
              >
                <FaTable />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                title="Cards View"
              >
                <FaTh />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'map'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                title="Map View"
              >
                <FaMap />
              </button>
            </div>
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
              <p className="text-gray-600 dark:text-gray-400 font-medium">Loading places...</p>
            </div>
          </motion.div>
        ) : places.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="text-6xl mb-4">📍</div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              No places yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Click &quot;Add Place&quot; to start tracking your places
            </p>
          </motion.div>
        ) : (
          <>
            {/* Table View */}
            {viewMode === 'table' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700"
              >
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={places.length > 0 && selectedPlaceIds.length === places.length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                            title="Select all"
                          />
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Address
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Category
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {places.map((place: Place, index: number) => (
                        <motion.tr
                          key={place.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedPlaceIds.includes(place.id)}
                              onChange={() => handleToggleSelectPlace(place.id)}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {place.name}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                              {place.address}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                              {place.category || 'other'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex gap-2">
                              <a
                                href={getGoogleMapsUrl(place.address, place.latitude, place.longitude)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                title="Open in Google Maps"
                              >
                                <FaMapMarkedAlt />
                              </a>
                              <button
                                onClick={() => handleEdit(place)}
                                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Edit place"
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => handleDelete(place.id)}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Delete place"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* Cards View */}
            {viewMode === 'cards' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {places.map((place: Place, index: number) => (
                  <motion.div
                    key={place.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            {place.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {place.address}
                          </p>
                        </div>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          {place.category || 'other'}
                        </span>
                      </div>

                      {place.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {place.description}
                        </p>
                      )}

                      <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <a
                          href={getGoogleMapsUrl(place.address, place.latitude, place.longitude)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <FaMapMarkedAlt />
                          Maps
                        </a>
                        <button
                          onClick={() => handleEdit(place)}
                          className="flex items-center justify-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(place.id)}
                          className="flex items-center justify-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Map View */}
            {viewMode === 'map' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="space-y-4"
              >
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Note:</strong> To enable interactive map view with pins, you would need to integrate Google Maps JavaScript API.
                    For now, each place has a &quot;View on Map&quot; button that opens Google Maps in a new tab.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {places.map((place: Place, index: number) => (
                    <motion.div
                      key={place.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          {place.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {place.address}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <a
                          href={getGoogleMapsUrl(place.address, place.latitude, place.longitude)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <FaMapMarkedAlt />
                          View on Map
                        </a>
                        <button
                          onClick={() => handleEdit(place)}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(place.id)}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center items-center py-6">
                <motion.button
                  whileHover={!loadingMore ? { scale: 1.05 } : {}}
                  whileTap={!loadingMore ? { scale: 0.95 } : {}}
                  onClick={loadMorePlaces}
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
                      Load More ({totalCount - places.length} remaining)
                    </>
                  )}
                </motion.button>
              </div>
            )}

            {/* End of List Indicator */}
            {!hasMore && places.length > 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                {searchQuery || categoryFilter ? `All matching places loaded (${totalCount} found)` : `All places loaded (${totalCount} total)`}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit/Add Place Dialog */}
      <Dialog
        open={editPlace !== null || showAddDialog}
        onClose={() => {
          setEditPlace(null);
          setShowAddDialog(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editPlace ? 'Edit Place' : 'Add Place'}
        </DialogTitle>
        <DialogContent>
          <div className="space-y-4 mt-4">
            <TextField
              fullWidth
              label="Name *"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              helperText="e.g., 'Home', 'Office', 'John's house'"
            />

            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Address Lookup
              </div>
              <AddressInput
                onAddressSelect={(data) => {
                  setFormData({
                    ...formData,
                    address: data.address,
                    latitude: data.latitude,
                    longitude: data.longitude,
                  });
                }}
                currentAddress={formData.address}
                currentLatitude={formData.latitude}
                currentLongitude={formData.longitude}
              />
            </div>

            <TextField
              fullWidth
              select
              label="Category"
              value={formData.category || 'home'}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              <MenuItem value="home">Home</MenuItem>
              <MenuItem value="work">Work</MenuItem>
              <MenuItem value="visited">Visited</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>

            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              helperText="Optional notes about this place"
            />

            <div className="flex gap-2 justify-end pt-4">
              <Button
                onClick={() => {
                  setEditPlace(null);
                  setShowAddDialog(false);
                }}
                startIcon={<FaTimes />}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSavePlace}
                disabled={!formData.name || !formData.address}
                startIcon={<FaCheck />}
              >
                {editPlace ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <DeleteDialog
        isOpen={deleteConfirmId !== null}
        title="Delete Place?"
        itemName={places.find(p => p.id === deleteConfirmId)?.name}
        onConfirmAction={confirmDelete}
        onCancelAction={cancelDelete}
      />

      {/* Delete Selected Dialog */}
      <DeleteDialog
        isOpen={showDeleteSelected}
        title={`Delete ${selectedPlaceIds.length} Place${selectedPlaceIds.length !== 1 ? 's' : ''}?`}
        itemName={`${selectedPlaceIds.length} selected place${selectedPlaceIds.length !== 1 ? 's' : ''}`}
        onConfirmAction={confirmDeleteSelected}
        onCancelAction={cancelDeleteSelected}
      />

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

"use client";

import { useState } from "react";
import { TextField, Button, Tabs, Tab, Box, CircularProgress } from "@mui/material";
import { FaSearch, FaMapMarkerAlt, FaLink } from "react-icons/fa";
import axios from "axios";

interface AddressInputProps {
  onAddressSelect: (data: {
    address: string;
    latitude?: number;
    longitude?: number;
  }) => void;
  currentAddress?: string;
  currentLatitude?: number;
  currentLongitude?: number;
}

export default function AddressInput({
  onAddressSelect,
  currentAddress,
  currentLatitude,
  currentLongitude,
}: AddressInputProps) {
  const [tabValue, setTabValue] = useState(0);

  // Google Maps link
  const [mapsLink, setMapsLink] = useState("");
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);

  // Current location
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Manual input
  const [manualAddress, setManualAddress] = useState(currentAddress || "");
  const [manualLat, setManualLat] = useState(currentLatitude?.toString() || "");
  const [manualLon, setManualLon] = useState(currentLongitude?.toString() || "");

  const handleMapsLinkParse = async () => {
    if (!mapsLink.trim()) {
      setMapsError("Please paste a Google Maps link");
      return;
    }

    setMapsLoading(true);
    setMapsError(null);

    try {
      // Parse Google Maps URL for coordinates
      // Formats:
      // - https://maps.google.com/?q=51.5074,-0.1278
      // - https://www.google.com/maps/place/.../@51.5074,-0.1278,17z
      // - https://goo.gl/maps/...

      const url = new URL(mapsLink);
      let lat: number | undefined;
      let lon: number | undefined;
      let address = "";

      // Check for ?q= parameter
      const qParam = url.searchParams.get('q');
      if (qParam) {
        const coords = qParam.split(',');
        if (coords.length === 2) {
          lat = parseFloat(coords[0]);
          lon = parseFloat(coords[1]);
        } else {
          // q might be an address
          address = qParam;
        }
      }

      // Check for /@lat,lon pattern
      const atMatch = mapsLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        lat = parseFloat(atMatch[1]);
        lon = parseFloat(atMatch[2]);
      }

      if (lat && lon) {
        // Reverse geocode to get address
        try {
          const geocodeResponse = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
          );

          if (geocodeResponse.data && geocodeResponse.data.display_name) {
            address = geocodeResponse.data.display_name;
          }
        } catch (geocodeError) {
          console.error("Reverse geocoding failed:", geocodeError);
          address = `Location at ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        }

        setManualAddress(address);
        setManualLat(lat.toString());
        setManualLon(lon.toString());

        onAddressSelect({
          address,
          latitude: lat,
          longitude: lon,
        });

        setMapsError("✓ Location extracted from Google Maps link!");
      } else if (address) {
        setManualAddress(address);
        onAddressSelect({ address });
        setMapsError("✓ Address extracted! Coordinates not found in link.");
      } else {
        setMapsError("Could not extract location from the link. Please try a different format.");
      }
    } catch (err) {
      setMapsError("Invalid Google Maps link. Please check and try again.");
    } finally {
      setMapsLoading(false);
    }
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
          // Try multiple reverse geocoding services for better accuracy
          let address = `Location at ${lat.toFixed(6)}, ${lon.toFixed(6)}`;

          // Try Nominatim first (OpenStreetMap)
          try {
            const nominatimResponse = await axios.get(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
              {
                headers: {
                  'User-Agent': 'PlacesApp/1.0'
                }
              }
            );

            if (nominatimResponse.data && nominatimResponse.data.display_name) {
              address = nominatimResponse.data.display_name;
            }
          } catch (nominatimError) {
            console.error("Nominatim geocoding failed:", nominatimError);
          }

          setManualAddress(address);
          setManualLat(lat.toString());
          setManualLon(lon.toString());

          onAddressSelect({
            address,
            latitude: lat,
            longitude: lon,
          });

          setLocationError(`✓ Current location captured! (±${Math.round(position.coords.accuracy)}m accuracy)`);
        } catch (err) {
          setManualAddress("");
          setManualLat(lat.toString());
          setManualLon(lon.toString());

          onAddressSelect({
            address: `Location at ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
            latitude: lat,
            longitude: lon,
          });

          setLocationError("✓ Location captured! (Address lookup failed, using coordinates)");
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        setLocationLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission denied. Please enable location access.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information unavailable.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out.");
            break;
          default:
            setLocationError("An unknown error occurred.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleManualSave = () => {
    if (!manualAddress.trim()) {
      return;
    }

    onAddressSelect({
      address: manualAddress,
      latitude: manualLat ? parseFloat(manualLat) : undefined,
      longitude: manualLon ? parseFloat(manualLon) : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Manual" />
          <Tab label="Maps Link" />
          <Tab label="My Location" />
        </Tabs>
      </Box>

      {/* Manual Tab */}
      {tabValue === 0 && (
        <div className="space-y-3 pt-2">
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Address"
            value={manualAddress}
            onChange={(e) => {
              setManualAddress(e.target.value);
              handleManualSave();
            }}
            placeholder="Enter full address"
          />
          <div className="grid grid-cols-2 gap-2">
            <TextField
              size="small"
              label="Latitude (optional)"
              value={manualLat}
              onChange={(e) => {
                setManualLat(e.target.value);
                handleManualSave();
              }}
              placeholder="e.g., 51.5074"
            />
            <TextField
              size="small"
              label="Longitude (optional)"
              value={manualLon}
              onChange={(e) => {
                setManualLon(e.target.value);
                handleManualSave();
              }}
              placeholder="e.g., -0.1278"
            />
          </div>
        </div>
      )}

      {/* Google Maps Link Tab */}
      {tabValue === 1 && (
        <div className="space-y-3 pt-2">
          <div className="flex gap-2">
            <TextField
              size="small"
              label="Google Maps Link"
              placeholder="Paste Google Maps URL"
              value={mapsLink}
              onChange={(e) => {
                setMapsLink(e.target.value);
                setMapsError(null);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleMapsLinkParse();
                }
              }}
              disabled={mapsLoading}
              className="flex-1"
            />
            <Button
              variant="contained"
              onClick={handleMapsLinkParse}
              disabled={mapsLoading || !mapsLink.trim()}
              startIcon={mapsLoading ? <CircularProgress size={16} /> : <FaLink />}
            >
              {mapsLoading ? "Parsing..." : "Parse"}
            </Button>
          </div>

          {mapsError && (
            <div className={`text-sm ${mapsError.includes('✓') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {mapsError}
            </div>
          )}

          <div className="text-xs text-gray-500 dark:text-gray-400">
            💡 <strong>Tip:</strong> Share a location on Google Maps, copy the link, and paste it here.
          </div>
        </div>
      )}

      {/* Current Location Tab */}
      {tabValue === 2 && (
        <div className="space-y-3 pt-2">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Note:</strong> GPS location can be approximate (10-100m accuracy). For best results, enable high-accuracy mode in your browser and be outdoors or near windows.
          </div>

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleCurrentLocation}
            disabled={locationLoading}
            startIcon={locationLoading ? <CircularProgress size={20} /> : <FaMapMarkerAlt />}
          >
            {locationLoading ? "Getting Location..." : "Use My Current Location"}
          </Button>

          {locationError && (
            <div className={`text-sm ${locationError.includes('✓') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {locationError}
            </div>
          )}

          <div className="text-xs text-gray-500 dark:text-gray-400">
            💡 <strong>Tip:</strong> You may need to grant location permission in your browser. The address will be automatically looked up from your coordinates.
          </div>
        </div>
      )}

      {/* Show current values */}
      {(manualAddress || manualLat || manualLon) && tabValue !== 0 && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Current Values:</div>
          {manualAddress && (
            <div className="text-sm text-gray-900 dark:text-white mb-1">
              <strong>Address:</strong> {manualAddress}
            </div>
          )}
          {manualLat && manualLon && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Coordinates:</strong> {manualLat}, {manualLon}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

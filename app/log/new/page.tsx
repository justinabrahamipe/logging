"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FaArrowLeft, FaMapMarkerAlt, FaMicrophone, FaStop } from "react-icons/fa";

export default function NewLogEntry() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({ latitude: "", longitude: "", date: new Date().toISOString().split("T")[0], time: new Date().toTimeString().slice(0, 5), notes: "" });
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const toggleVoice = () => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setFormData(prev => ({ ...prev, notes: transcript }));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  useEffect(() => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setDetecting(false);
      },
      () => setDetecting(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleSave = async () => {
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (isNaN(lat) || isNaN(lng) || !formData.date) return;
    setSaving(true);
    try {
      await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lng, date: formData.date, time: formData.time, notes: formData.notes }),
      });
      router.push("/log");
    } catch (err) {
      console.error("Failed to save:", err);
      setSaving(false);
    }
  };

  if (status === "loading") return null;

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/log")} className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700">
          <FaArrowLeft />
        </button>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">New Entry</h1>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Latitude</label>
            <input
              type="number"
              step="any"
              value={formData.latitude}
              onChange={e => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
              placeholder={detecting ? "Detecting..." : "-90 to 90"}
              className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Longitude</label>
            <input
              type="number"
              step="any"
              value={formData.longitude}
              onChange={e => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
              placeholder={detecting ? "Detecting..." : "-180 to 180"}
              className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white"
            />
          </div>
        </div>

        <button
          onClick={() => {
            if (!navigator.geolocation) return;
            setDetecting(true);
            navigator.geolocation.getCurrentPosition(
              (pos) => { setFormData(prev => ({ ...prev, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })); setDetecting(false); },
              () => setDetecting(false),
              { enableHighAccuracy: true, timeout: 10000 }
            );
          }}
          disabled={detecting}
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
        >
          <FaMapMarkerAlt className="text-[10px]" />
          {detecting ? "Detecting GPS..." : "Re-detect location"}
        </button>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Time</label>
            <input
              type="time"
              value={formData.time}
              onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Notes</label>
            <button
              type="button"
              onClick={toggleVoice}
              className={`p-1.5 rounded-lg transition-colors ${listening ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
              title={listening ? "Stop recording" : "Voice input"}
            >
              {listening ? <FaStop className="text-xs" /> : <FaMicrophone className="text-xs" />}
            </button>
          </div>
          <textarea
            value={formData.notes}
            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            rows={4}
            placeholder={listening ? "Listening..." : "What happened here..."}
            className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white resize-none ${listening ? "border-red-300 dark:border-red-700" : "border-zinc-200 dark:border-zinc-700"}`}
            autoFocus
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !formData.latitude || !formData.longitude || !formData.date}
          className="w-full py-2.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

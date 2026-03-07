"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FaArrowLeft } from "react-icons/fa";
import PillarForm from "../components/PillarForm";

export default function NewPillarPage() {
  const { status } = useSession();
  const router = useRouter();

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const handleSave = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/pillars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      router.push("/pillars");
    }
  };

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/pillars")}
          className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <FaArrowLeft />
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">New Pillar</h1>
      </div>

      <PillarForm editingPillar={null} onCancel={() => router.push("/pillars")} onSave={handleSave} />
    </div>
  );
}

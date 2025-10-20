"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FinancePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to transactions page by default
    router.push("/finance/transactions");
  }, [router]);

  return null;
}

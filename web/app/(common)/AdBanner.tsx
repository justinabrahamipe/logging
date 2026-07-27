"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adsbygoogle?: any[];
  }
}

export default function AdBanner({
  slot,
  format = "auto",
  className = "",
}: {
  slot: string;
  format?: "auto" | "horizontal" | "rectangle";
  className?: string;
}) {
  const { data: session, status } = useSession();
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      setIsPremium(null);
      return;
    }
    const cached = sessionStorage.getItem("userSettings");
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.isPremium) { setIsPremium(true); return; }
      } catch {}
    }
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setIsPremium(!!data.isPremium);
      })
      .catch(() => setIsPremium(false));
  }, [session, status]);

  useEffect(() => {
    if (isPremium !== false) return;
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {}
  }, [isPremium]);

  // Don't show ads: unauthenticated, premium, or still loading
  if (status !== "authenticated" || isPremium !== false) return null;

  return (
    <div className={`w-full flex justify-center my-4 ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_ID || ""}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

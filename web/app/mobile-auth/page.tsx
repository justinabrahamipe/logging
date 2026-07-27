"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Suspense } from "react";
import { Card, CardContent, CircularProgress } from "@mui/material";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md rounded-xl shadow-sm">
        <CardContent className="text-center p-6 md:p-8 flex flex-col items-center gap-4">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

function MobileAuthContent() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const redirectUri = searchParams.get("redirect_uri");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated" && redirectUri) {
      signIn("google", { callbackUrl: `/mobile-auth?redirect_uri=${encodeURIComponent(redirectUri)}` });
    }
  }, [status, redirectUri]);

  useEffect(() => {
    if (status !== "authenticated" || !redirectUri || started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/settings/api-key", { method: "POST" });
        const data = await res.json();
        if (res.ok && data.apiKey) {
          const url = new URL(redirectUri);
          url.searchParams.set("apiKey", data.apiKey);
          url.searchParams.set("baseUrl", window.location.origin);
          window.location.href = url.toString();
        } else {
          setError("Couldn't generate an API key. Please try again from the app.");
        }
      } catch {
        setError("Something went wrong. Please try again from the app.");
      }
    })();
  }, [status, redirectUri]);

  if (!redirectUri) {
    return <Centered>Open this page from the Grind Console mobile app — it's missing what it needs to send you back.</Centered>;
  }
  if (error) {
    return <Centered>{error}</Centered>;
  }
  return (
    <Centered>
      <CircularProgress size={28} />
      <p className="text-zinc-600 dark:text-zinc-400 text-sm">Signing you in…</p>
    </Centered>
  );
}

export default function MobileAuthPage() {
  return (
    <Suspense fallback={<Centered><CircularProgress size={28} /></Centered>}>
      <MobileAuthContent />
    </Suspense>
  );
}

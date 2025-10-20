"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, Button } from "@mui/material";
import Link from "next/link";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case "Configuration":
        return "There is a problem with the server configuration.";
      case "AccessDenied":
        return "Access denied. You do not have permission to sign in.";
      case "Verification":
        return "The verification link is invalid or has expired.";
      case "Default":
      default:
        return "An error occurred during authentication.";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md rounded-xl shadow-lg">
        <CardContent className="text-center p-6 md:p-8">
          <h1 className="mb-4 text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Authentication Error</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm md:text-base">
            {getErrorMessage(error)}
          </p>
          <Link href="/login" passHref>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              className="py-2.5 md:py-3 text-sm md:text-base touch-target"
            >
              Back to Sign In
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4">
          <Card className="w-full max-w-md rounded-xl shadow-lg">
            <CardContent className="text-center p-6 md:p-8">
              <h1 className="mb-4 text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Loading...</h1>
            </CardContent>
          </Card>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}

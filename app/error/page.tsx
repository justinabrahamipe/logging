"use client";

import { Card, Button } from "flowbite-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

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
      <Card className="w-full max-w-md">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Authentication Error</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {getErrorMessage(error)}
          </p>
          <Button href="/login" className="w-full">
            Back to Sign In
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4">
          <Card className="w-full max-w-md">
            <div className="text-center">
              <h1 className="mb-4 text-2xl font-bold">Loading...</h1>
            </div>
          </Card>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}

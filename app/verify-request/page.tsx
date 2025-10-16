import { Card } from "flowbite-react";

export default function VerifyRequest() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Check your email</h1>
          <p className="text-gray-600 dark:text-gray-400">
            A sign in link has been sent to your email address.
          </p>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
            Click the link in the email to complete the sign in process. You
            can close this window.
          </p>
        </div>
      </Card>
    </div>
  );
}

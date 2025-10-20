import { Card, CardContent } from "@mui/material";

export default function VerifyRequest() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md rounded-xl shadow-lg">
        <CardContent className="text-center p-6 md:p-8">
          <h1 className="mb-4 text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Check your email</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
            A sign in link has been sent to your email address.
          </p>
          <p className="mt-4 text-xs md:text-sm text-gray-500 dark:text-gray-500">
            Click the link in the email to complete the sign in process. You
            can close this window.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

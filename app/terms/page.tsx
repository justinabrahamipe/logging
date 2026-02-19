import Link from "next/link";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Terms of Service
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Last updated: February 18, 2026
          </p>

          <div className="space-y-6 text-gray-700 dark:text-gray-300">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing and using Total Logger, you accept and agree to be bound by these Terms of Service.
                If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                2. Description of Service
              </h2>
              <p>
                Total Logger is a life gamification and productivity application that allows you to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>Define life pillars and set weighted priorities</li>
                <li>Create and track daily tasks with various completion types</li>
                <li>Earn points, XP, and level up based on daily performance</li>
                <li>Track streaks and monitor progress over time</li>
                <li>View daily action scores and pillar breakdowns</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                3. User Accounts
              </h2>
              <p className="mb-2">
                To use Total Logger, you must:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Have a valid Google account</li>
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account</li>
                <li>Be at least 13 years of age</li>
              </ul>
              <p className="mt-2">
                You are responsible for all activities that occur under your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                4. Google Account Integration
              </h2>
              <p>
                By connecting your Google account, you grant Total Logger permission to access your basic
                profile information (name, email, profile picture) for authentication purposes.
              </p>
              <p className="mt-2">
                You can revoke these permissions at any time through your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Google Account settings
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                5. User Conduct
              </h2>
              <p className="mb-2">You agree not to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Use the service for any illegal purpose</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Interfere with or disrupt the service</li>
                <li>Upload malicious code or viruses</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                6. Data Ownership
              </h2>
              <p>
                You retain all rights to the data you create and store in Total Logger. We claim no ownership
                over your pillars, tasks, scores, or any other data. You can export or delete your
                data at any time.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                7. Service Availability
              </h2>
              <p>
                We strive to provide a reliable service, but we do not guarantee that Total Logger will be
                available at all times. We may need to perform maintenance, updates, or make changes to the
                service without prior notice.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                8. Disclaimer of Warranties
              </h2>
              <p>
                Total Logger is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either
                express or implied. We do not warrant that the service will be uninterrupted, secure, or error-free.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                9. Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by law, Total Logger and its developers shall not be liable
                for any indirect, incidental, special, consequential, or punitive damages resulting from your
                use or inability to use the service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                10. Account Termination
              </h2>
              <p className="mb-2">
                We reserve the right to suspend or terminate your account if:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You violate these Terms of Service</li>
                <li>You engage in fraudulent or illegal activity</li>
                <li>We are required to do so by law</li>
              </ul>
              <p className="mt-2">
                You may delete your account at any time through the application settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                11. Changes to Terms
              </h2>
              <p>
                We may modify these Terms of Service at any time. We will notify users of significant changes
                by posting a notice in the application or via email. Your continued use of Total Logger after
                such modifications constitutes acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                12. Contact Information
              </h2>
              <p>
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <p className="mt-2">
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:justinabrahamipe@gmail.com"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  justinabrahamipe@gmail.com
                </a>
              </p>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              &larr; Back to Total Logger
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

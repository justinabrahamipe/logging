export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Last updated: February 18, 2026
          </p>

          <div className="space-y-6 text-gray-700 dark:text-gray-300">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                1. Introduction
              </h2>
              <p>
                Welcome to Total Logger. We respect your privacy and are committed to protecting your personal data.
                This privacy policy explains how we collect, use, and safeguard your information when you use our application.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                2. Information We Collect
              </h2>
              <p className="mb-2">We collect the following types of information:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Account Information:</strong> Name, email address, and profile picture from your Google account</li>
                <li><strong>Application Data:</strong> Pillars, tasks, task completions, daily scores, and user stats you create within the application</li>
                <li><strong>Preferences:</strong> Theme, date/time format, and score threshold settings</li>
                <li><strong>Authentication Tokens:</strong> OAuth tokens to authenticate your Google account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                3. How We Use Your Information
              </h2>
              <p className="mb-2">We use your information to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide and maintain our service</li>
                <li>Authenticate your identity</li>
                <li>Track your tasks, scores, and progress</li>
                <li>Calculate XP, levels, and streaks</li>
                <li>Improve and personalize your experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                4. Data Storage and Security
              </h2>
              <p>
                Your data is stored securely in our database hosted on Turso. We use industry-standard
                security measures including encrypted connections (SSL/TLS) and secure authentication protocols.
                Access tokens are stored encrypted and are never shared with third parties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                5. Google API Services
              </h2>
              <p className="mb-2">
                Total Logger uses Google APIs to authenticate your account. Our use of information
                received from Google APIs adheres to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Google API Services User Data Policy
                </a>, including the Limited Use requirements.
              </p>
              <p className="mb-2">Specifically, we access:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Basic Profile Information:</strong> Your name, email, and profile picture for authentication</li>
              </ul>
              <p className="mt-2">
                We do not use this data for advertising, profiling, or any purpose other than providing the
                core functionality of Total Logger.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                6. Data Sharing
              </h2>
              <p>
                We do not sell, trade, or rent your personal information to third parties. Your data is used
                solely within Total Logger to provide you with the services you requested.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                7. Your Rights
              </h2>
              <p className="mb-2">You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Delete your account and all associated data</li>
                <li>Revoke access to your Google account at any time</li>
                <li>Export your data</li>
              </ul>
              <p className="mt-2">
                To exercise these rights, please use the Settings page within the application,
                or contact us at justinabrahamipe@gmail.com.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                8. Revoking Access
              </h2>
              <p>
                You can revoke Total Logger&apos;s access to your Google account at any time by visiting your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Google Account Permissions page
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                9. Data Retention
              </h2>
              <p>
                We retain your data for as long as your account is active. If you delete your account,
                all associated data will be permanently deleted from our systems.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                10. Children&apos;s Privacy
              </h2>
              <p>
                Total Logger is not intended for users under the age of 13. We do not knowingly collect
                personal information from children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                11. Changes to This Policy
              </h2>
              <p>
                We may update this privacy policy from time to time. We will notify you of any changes by
                posting the new privacy policy on this page and updating the &quot;Last updated&quot; date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                12. Contact Us
              </h2>
              <p>
                If you have any questions about this privacy policy or our data practices, please contact us at:
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
            <a
              href="/"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              &larr; Back to Total Logger
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

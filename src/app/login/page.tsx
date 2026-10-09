"use client";

import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const params = new URLSearchParams(window.location.search);

    const redirect =
      params.get("redirect") || "/dashboard";

    const callbackUrl =
      `${window.location.origin}/verbly-ai/auth/callback` +
      `?next=${encodeURIComponent(redirect)}`;

    console.log("Google OAuth callback:", callbackUrl);

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",

        options: {
          redirectTo: callbackUrl,
        },
      });

    if (error) {
      console.error(
        "Google login error:",
        error.message,
      );

      alert(error.message);
    }
  };

  return (
    <main className="min-h-screen bg-[#07070c] text-white flex items-center justify-center px-6 py-10">

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-6xl">

        {/* Main Card */}
        <div className="grid overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur-xl md:grid-cols-2">

          {/* LEFT SIDE */}
          <div className="hidden min-h-[600px] flex-col justify-between bg-gradient-to-br from-purple-600/20 via-[#11111a] to-blue-600/10 p-12 md:flex">

            <div>
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 text-xl font-bold shadow-lg shadow-purple-500/20">
                  V
                </div>

                <span className="text-2xl font-bold tracking-tight">
                  Verbly AI
                </span>
              </div>

              {/* Main Text */}
              <div className="mt-28 max-w-md">
                <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-purple-400">
                  AI-Powered Website Analysis
                </p>

                <h1 className="text-5xl font-bold leading-tight">
                  Make your website
                  <span className="block bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    better with AI.
                  </span>
                </h1>

                <p className="mt-6 text-lg leading-8 text-gray-400">
                  Analyze grammar, readability, SEO and
                  content quality — all in one place.
                </p>
              </div>
            </div>

            {/* Bottom */}
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="h-2 w-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
              Smart analysis • Simple insights
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex min-h-[600px] items-center justify-center p-8 sm:p-12">

            <div className="w-full max-w-sm">

              {/* Mobile Logo */}
              <div className="mb-10 flex items-center justify-center gap-3 md:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 font-bold">
                  V
                </div>

                <span className="text-xl font-bold">
                  Verbly AI
                </span>
              </div>

              {/* Heading */}
              <div className="text-center">

                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-500/10">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />

                    <path
                      d="M19.4 15C19.55 15.45 19.75 15.85 20 16.2L20.05 16.25C20.5 16.75 20.5 17.55 20 18.05L18.05 20C17.55 20.5 16.75 20.5 16.25 20L16.2 19.95C15.85 19.7 15.45 19.5 15 19.35C14.7 19.25 14.4 19.15 14.1 19.1C13.75 19.05 13.45 19 13.1 19H10.9C10.55 19 10.25 19.05 9.9 19.1C9.6 19.15 9.3 19.25 9 19.35C8.55 19.5 8.15 19.7 7.8 19.95L7.75 20C7.25 20.5 6.45 20.5 5.95 20L4 18.05C3.5 17.55 3.5 16.75 4 16.25L4.05 16.2C4.3 15.85 4.5 15.45 4.65 15C4.75 14.7 4.85 14.4 4.9 14.1C4.95 13.75 5 13.45 5 13.1V10.9C5 10.55 4.95 10.25 4.9 9.9C4.85 9.6 4.75 9.3 4.65 9C4.5 8.55 4.3 8.15 4.05 7.8L4 7.75C3.5 7.25 3.5 6.45 4 5.95L5.95 4C6.45 3.5 7.25 3.5 7.75 4L7.8 4.05C8.15 4.3 8.55 4.5 9 4.65C9.3 4.75 9.6 4.85 9.9 4.9C10.25 4.95 10.55 5 10.9 5H13.1C13.45 5 13.75 4.95 14.1 4.9C14.4 4.85 14.7 4.75 15 4.65C15.45 4.5 15.85 4.3 16.2 4.05L16.25 4C16.75 3.5 17.55 3.5 18.05 4L20 5.95C20.5 6.45 20.5 7.25 20 7.75L19.95 7.8C19.7 8.15 19.5 8.55 19.35 9C19.25 9.3 19.15 9.6 19.1 9.9C19.05 10.25 19 10.55 19 10.9V13.1C19 13.45 19.05 13.75 19.1 14.1C19.15 14.4 19.25 14.7 19.4 15Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <h2 className="text-3xl font-bold">
                  Welcome back
                </h2>

                <p className="mt-3 text-gray-400">
                  Sign in to continue to Verbly AI
                </p>
              </div>

              {/* Login Box */}
              <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-6">

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="group flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 font-semibold text-gray-900 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-100 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#101018]"
                >

                  {/* Google Icon */}
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="#4285F4"
                      d="M21.35 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.38z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 21.9c2.63 0 4.84-.87 6.45-2.37l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.29v2.53A9.74 9.74 0 0 0 12 21.9z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M6.54 13.97A5.85 5.85 0 0 1 6.24 12c0-.68.12-1.34.3-1.97V7.5H3.29A9.74 9.74 0 0 0 2.25 12c0 1.57.38 3.05 1.04 4.5l3.25-2.53z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.98c1.43 0 2.72.49 3.73 1.45l2.79-2.79C16.84 3.02 14.63 2.1 12 2.1a9.74 9.74 0 0 0-8.71 5.4l3.25 2.53C7.31 7.7 9.46 5.98 12 5.98z"
                    />
                  </svg>

                  <span>Continue with Google</span>
                </button>

                <p className="mt-5 text-center text-xs leading-5 text-gray-500">
                  By continuing, you agree to use Verbly AI
                  responsibly.
                </p>
              </div>

              {/* Footer */}
              <p className="mt-8 text-center text-sm text-gray-500">
                AI-powered website analysis
              </p>

            </div>
          </div>

        </div>

        {/* Bottom text */}
        <p className="mt-6 text-center text-xs text-gray-600">
          © 2026 Verbly AI. Built for smarter websites.
        </p>

      </div>
    </main>
  );
}
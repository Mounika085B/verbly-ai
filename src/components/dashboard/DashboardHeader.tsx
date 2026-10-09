"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function DashboardHeader() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userAvatar, setUserAvatar] = useState("");
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const user = session.user;

        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User";

        const avatar =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          "";

        setIsLoggedIn(true);
        setUserName(name);
        setUserEmail(user.email || "");
        setUserAvatar(avatar);
      } else {
        setIsLoggedIn(false);
        setUserName("");
        setUserEmail("");
        setUserAvatar("");
      }
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          const user = session.user;

          const name =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "User";

          const avatar =
            user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            "";

          setIsLoggedIn(true);
          setUserName(name);
          setUserEmail(user.email || "");
          setUserAvatar(avatar);
        } else {
          setIsLoggedIn(false);
          setUserName("");
          setUserEmail("");
          setUserAvatar("");
          setShowProfile(false);
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "Logout error:",
        error.message,
      );

      alert(error.message);

      return;
    }

    setIsLoggedIn(false);
    setUserName("");
    setUserEmail("");
    setUserAvatar("");
    setShowProfile(false);
  };

  const firstLetter =
    userName.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#08090D]/75 backdrop-blur-2xl">

      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">

        {/* Brand */}

        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A78BFA]"
          aria-label="Verbly AI home"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/10 transition-all duration-300 group-hover:scale-105 group-hover:border-[#7C5CFF]/60 group-hover:bg-[#7C5CFF]/15">

            <span className="absolute inset-0 rounded-xl bg-[#7C5CFF]/10 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />

            <Sparkles
              className="relative h-[17px] w-[17px] text-[#A78BFA]"
              aria-hidden="true"
            />

          </span>

          <span className="text-[19px] font-semibold tracking-tight text-white">
            Verbly
            <span className="text-[#8B6FFF]">
              AI
            </span>
          </span>
        </Link>

        {/* Dashboard label */}

        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-slate-400 sm:flex">

          <span className="h-1.5 w-1.5 rounded-full bg-[#7C5CFF] shadow-[0_0_8px_rgba(124,92,255,0.7)]" />

          Dashboard

        </div>

        {/* Right side */}

        <div className="flex items-center gap-2">

          {isLoggedIn ? (
            <div className="relative">

              {/* Profile Circle */}

              <button
                type="button"
                onClick={() =>
                  setShowProfile((prev) => !prev)
                }
                aria-label="Open profile menu"
                aria-expanded={showProfile}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[#7C5CFF]/40 bg-[#7C5CFF]/10 text-sm font-semibold text-white shadow-[0_0_15px_rgba(124,92,255,0.15)] transition-all duration-300 hover:scale-105 hover:border-[#A78BFA]/70 hover:bg-[#7C5CFF]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A78BFA]"
              >

                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={userName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  firstLetter
                )}

              </button>

              {/* Profile Dropdown */}

              {showProfile && (
                <div className="absolute right-0 top-12 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#111219]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl">

                  {/* User information */}

                  <div className="rounded-xl px-3 py-3">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#7C5CFF] to-[#4F46E5] text-sm font-bold text-white">

                        {userAvatar ? (
                          <img
                            src={userAvatar}
                            alt={userName}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          firstLetter
                        )}

                      </div>

                      <div className="min-w-0">

                        <p className="truncate text-sm font-semibold text-white">
                          {userName}
                        </p>

                        <p className="truncate text-xs text-slate-500">
                          {userEmail}
                        </p>

                      </div>

                    </div>

                  </div>

                  <div className="my-1 h-px bg-white/[0.07]" />

                  {/* Logout */}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-red-500/10 hover:text-red-400"
                  >

                    <LogOut className="h-4 w-4" />

                    Logout

                  </button>

                </div>
              )}

            </div>
          ) : (
            <Link
              href="/login?redirect=%2Fdashboard"
              className="inline-flex items-center rounded-xl border border-[#7C5CFF]/40 bg-[#7C5CFF]/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-[#7C5CFF]/70 hover:bg-[#7C5CFF]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A78BFA] active:translate-y-0"
            >
              Login
            </Link>
          )}

          {/* Back to Home */}

          <Link
            href="/"
            aria-label="Back to home"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-medium text-slate-200 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A78BFA] active:translate-y-0"
          >
            <ArrowLeft
              className="h-4 w-4"
              aria-hidden="true"
            />

            <span className="hidden sm:inline">
              Back to home
            </span>
          </Link>

        </div>

      </div>

    </header>
  );
}
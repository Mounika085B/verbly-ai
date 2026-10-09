import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set(
                  name,
                  value,
                  options,
                );
              },
            );
          } catch {
            // Ignore cookie errors when cookies
            // cannot be modified.
          }
        },
      },
    },
  );

  /*
   * Google did not provide an authorization code.
   */
  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/verbly-ai/login?error=auth",
        request.url,
      ),
    );
  }

  /*
   * Exchange Google's authorization code
   * for a Supabase session.
   */
  const { error } =
    await supabase.auth.exchangeCodeForSession(
      code,
    );

  /*
   * Authentication failed.
   */
  if (error) {
    console.error(
      "Auth callback error:",
      error.message,
    );

    return NextResponse.redirect(
      new URL(
        "/verbly-ai/login?error=auth",
        request.url,
      ),
    );
  }

  /*
   * Only allow internal dashboard/login routes.
   */
  let redirectPath = "/dashboard";

  if (next === "/dashboard") {
    redirectPath = "/dashboard";
  }

  /*
   * IMPORTANT:
   * Because this is a server-side redirect,
   * we explicitly include the basePath.
   */
  return NextResponse.redirect(
    new URL(
      `/verbly-ai${redirectPath}`,
      request.url,
    ),
  );
}
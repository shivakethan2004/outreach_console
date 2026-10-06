import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { readSupabaseConfig } from "@/lib/supabase/config";

const PUBLIC_PATHS = new Set(["/setup", "/sign-in", "/api/auth/sign-in"]);
const PUBLIC_ASSETS = new Set(["/icon.svg", "/offline.html", "/sw.js"]);

function copySessionCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  }
  return target;
}

export async function proxy(request: NextRequest) {
  const config = readSupabaseConfig();
  const path = request.nextUrl.pathname;

  if (PUBLIC_ASSETS.has(path)) return NextResponse.next({ request });

  if (!config) {
    if (path === "/setup" || path.startsWith("/_next/") || path === "/favicon.ico") {
      return NextResponse.next({ request });
    }
    if (path.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 }
      );
    }
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  if (error) {
    console.error("Supabase session verification failed:", error.message);
    return NextResponse.json(
      { error: "Unable to verify the session. Please try again." },
      { status: 503 }
    );
  }

  const hasClaims = Boolean(data?.claims);
  const isPublic = PUBLIC_PATHS.has(path);
  if (!hasClaims && !isPublic) {
    if (path.startsWith("/api/")) {
      return copySessionCookies(
        response,
        NextResponse.json({ error: "Authentication required." }, { status: 401 })
      );
    }
    return copySessionCookies(
      response,
      NextResponse.redirect(new URL("/sign-in", request.url))
    );
  }

  if (hasClaims && path === "/sign-in") {
    return copySessionCookies(response, NextResponse.redirect(new URL("/", request.url)));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};

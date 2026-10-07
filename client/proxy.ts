import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const protectedPath = request.nextUrl.pathname.startsWith("/app") || request.nextUrl.pathname.startsWith("/reports");
  const sessionToken = request.cookies.get("campuslink_session")?.value;
  if (protectedPath && !sessionToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const dashboardRole = request.nextUrl.pathname.startsWith("/app/student-dashboard")
    ? "student"
    : request.nextUrl.pathname.startsWith("/app/security-dashboard")
      ? "staff"
      : null;

  if (dashboardRole) {
    const apiOrigin = process.env.API_SERVER_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3001" : request.nextUrl.origin);
    try {
      // Ask Express to verify the HttpOnly cookie and return the database-backed role.
      const sessionResponse = await fetch(`${apiOrigin.replace(/\/$/, "")}/api/v1/auth/session`, {
        headers: { cookie: `campuslink_session=${encodeURIComponent(sessionToken!)}` },
        cache: "no-store",
      });
      if (!sessionResponse.ok) return NextResponse.redirect(new URL("/", request.url));

      const session = await sessionResponse.json() as { account_type?: string };
      if (session.account_type !== "student" && session.account_type !== "staff") {
        return NextResponse.redirect(new URL("/", request.url));
      }

      const expectedRole = session.account_type === "staff" ? "staff" : "student";
      if (dashboardRole !== expectedRole) {
        const destination = expectedRole === "staff" ? "/app/security-dashboard" : "/app/student-dashboard";
        return NextResponse.redirect(new URL(destination, request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/reports/:path*"],
};
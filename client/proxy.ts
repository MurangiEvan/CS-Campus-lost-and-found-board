import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const protectedPath = request.nextUrl.pathname.startsWith("/app") || request.nextUrl.pathname.startsWith("/reports");
  if (protectedPath && !request.cookies.get("campuslink_session")?.value) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/reports/:path*"],
};
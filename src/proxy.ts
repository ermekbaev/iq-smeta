import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Защищаем админку, экран записи и доменные API. Публичны: /login, /api/auth/*.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/";

  if (!isAuthed && !isPublic) {
    // API — отдаём JSON 401, страницы — редиректим на логин
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthed && pathname === "/login") {
    return NextResponse.redirect(new URL("/admin", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // исключаем статику и _next
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon.svg|icons).*)",
  ],
};

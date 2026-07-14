import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Защищаем админку, экран записи и доменные API.
// Публичны: /login, /register, /api/auth/*, корень.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth;

  const isPublic =
    pathname === "/login" ||
    pathname === "/register" ||
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

  // залогиненного с экранов входа/регистрации уводим в админку
  if (isAuthed && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // исключаем статику, _next и публичный логотип (нужен на /login и /register)
  // proxy не трогает _next и ЛЮБОЙ файл с расширением (svg/png/js/json…) —
  // статика (включая логотип на /login и /register) публична для всех
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};

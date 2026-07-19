// Обёртки авторизации: убирают повтор `if (!session) 401` в роутах и
// non-null `session!.user.id` в серверных компонентах.

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isGlobalSynonymAdmin } from "@/lib/synonyms-admin";

/**
 * Требует авторизацию в API-роуте.
 * Возвращает `{ userId }` либо готовый Response 401.
 *
 *   const gate = await requireUser();
 *   if (gate instanceof NextResponse) return gate;
 *   const { userId } = gate;
 */
export async function requireUser(): Promise<{ userId: string } | NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return { userId };
}

/**
 * Возвращает id текущего пользователя в серверном компоненте
 * (при отсутствии сессии уводит на /login). Убирает `session!.user.id`.
 */
export async function currentUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  return userId;
}

/**
 * Требует, чтобы текущий пользователь был сопровождающим ОБЩЕЙ базы синонимов.
 * Возвращает `{ userId }` либо 401/403.
 */
export async function requireGlobalSynonymAdmin(): Promise<{ userId: string } | NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isGlobalSynonymAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return { userId };
}

/** Является ли текущий пользователь сопровождающим общей базы (для серверных компонентов). */
export async function isCurrentUserGlobalAdmin(): Promise<boolean> {
  const session = await auth();
  return isGlobalSynonymAdmin(session?.user?.email);
}

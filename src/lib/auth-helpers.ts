// Обёртки авторизации: убирают повтор `if (!session) 401` в роутах и
// non-null `session!.user.id` в серверных компонентах.

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
 * E-mail текущего пользователя. Берём из сессии, но если её форма его не отдала —
 * достаём из БД по id: от этой почты зависит доступ к общей базе, и молча
 * потерять её нельзя (иначе блок «Общая база» не увидит никто).
 */
async function sessionEmail(session: Session | null): Promise<string | null> {
  const direct = session?.user?.email;
  if (direct) return direct;
  const id = session?.user?.id;
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  return u?.email ?? null;
}

/**
 * Требует, чтобы текущий пользователь был сопровождающим ОБЩЕЙ базы синонимов.
 * Возвращает `{ userId }` либо 401/403.
 */
export async function requireGlobalSynonymAdmin(): Promise<{ userId: string } | NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isGlobalSynonymAdmin(await sessionEmail(session))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return { userId };
}

/** Является ли текущий пользователь сопровождающим общей базы (для серверных компонентов). */
export async function isCurrentUserGlobalAdmin(): Promise<boolean> {
  const session = await auth();
  return isGlobalSynonymAdmin(await sessionEmail(session));
}

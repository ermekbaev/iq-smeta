// Обёртки авторизации: убирают повтор `if (!session) 401` в роутах и
// non-null `session!.user.id` в серверных компонентах.

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

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

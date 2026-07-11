import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { signIn, auth } from "@/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  code: z.string().min(1),
});

// Коды ошибок → тексты (в query, чтобы не тянуть состояние на сервер-компонент).
const ERRORS: Record<string, string> = {
  code: "Неверный код-приглашение",
  exists: "Аккаунт с таким email уже есть",
  invalid: "Проверьте email и пароль (пароль от 8 символов)",
  disabled: "Регистрация сейчас недоступна",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/admin");
  const { error } = await searchParams;

  async function register(formData: FormData) {
    "use server";
    const parsed = schema.safeParse({
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      password: String(formData.get("password") ?? ""),
      code: String(formData.get("code") ?? "").trim(),
    });
    if (!parsed.success) redirect("/register?error=invalid");

    const { email, password, code } = parsed.data;

    const invite = process.env.INVITE_CODE;
    if (!invite) redirect("/register?error=disabled");
    if (code !== invite) redirect("/register?error=code");

    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) redirect("/register?error=exists");

    const passwordHash = await bcrypt.hash(password, 10);
    try {
      await prisma.user.create({ data: { email, passwordHash } });
    } catch (e) {
      // гонка: email заняли между проверкой и созданием (unique violation)
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        redirect("/register?error=exists");
      }
      throw e;
    }

    try {
      await signIn("credentials", { email, password, redirectTo: "/admin" });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login");
      throw e; // редирект NextAuth пробрасываем дальше
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form
        action={register}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-iqsmeta.svg" alt="IQ Smeta" className="mx-auto h-9 w-auto" />
        <h1 className="text-center text-sm text-gray-500">Создать аккаунт</h1>
        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">
            {ERRORS[error] ?? "Не удалось зарегистрироваться"}
          </p>
        )}
        <label className="block space-y-1">
          <span className="text-sm text-gray-700">Email</span>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-900"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-gray-700">Пароль</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-900"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-gray-700">Код-приглашение</span>
          <input
            name="code"
            type="text"
            required
            className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-900"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded bg-gray-900 px-3 py-2 font-medium text-white hover:bg-gray-700"
        >
          Зарегистрироваться
        </button>
        <p className="text-center text-sm text-gray-500">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-gray-900 hover:underline">
            Войти
          </Link>
        </p>
      </form>
    </main>
  );
}

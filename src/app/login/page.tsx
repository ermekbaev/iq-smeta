import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { AuthError } from "next-auth";
import PasswordField from "@/components/PasswordField";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/admin");

  const { from, error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const target = String(formData.get("from") || "/admin");
    try {
      await signIn("credentials", { email, password, redirectTo: target });
    } catch (e) {
      if (e instanceof AuthError) {
        redirect(`/login?error=1${from ? `&from=${from}` : ""}`);
      }
      throw e; // редирект NextAuth пробрасываем дальше
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form
        action={login}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-iqsmeta.svg" alt="IQ Smeta" className="mx-auto h-9 w-auto" />
        <h1 className="text-center text-sm text-gray-500">Вход в систему</h1>
        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">
            Неверный email или пароль
          </p>
        )}
        <input type="hidden" name="from" value={from ?? "/admin"} />
        <label className="block space-y-1">
          <span className="text-sm text-gray-700">Email</span>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-900"
          />
        </label>
        <PasswordField autoComplete="current-password" />
        <button
          type="submit"
          className="w-full rounded bg-gray-900 px-3 py-2 font-medium text-white hover:bg-gray-700"
        >
          Войти
        </button>
        <p className="text-center text-sm text-gray-500">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-gray-900 hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </main>
  );
}

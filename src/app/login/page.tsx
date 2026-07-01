import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { AuthError } from "next-auth";

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
        <h1 className="text-xl font-semibold text-gray-900">IQ SMETA — вход</h1>
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
        <label className="block space-y-1">
          <span className="text-sm text-gray-700">Пароль</span>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-900"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded bg-gray-900 px-3 py-2 font-medium text-white hover:bg-gray-700"
        >
          Войти
        </button>
      </form>
    </main>
  );
}

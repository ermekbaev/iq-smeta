import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="font-semibold text-gray-900">
              IQ SMETA
            </Link>
            <Link href="/admin/price" className="text-gray-600 hover:text-gray-900">
              Прайс
            </Link>
            <Link href="/admin/estimates" className="text-gray-600 hover:text-gray-900">
              Сметы
            </Link>
            <Link href="/record" className="text-gray-600 hover:text-gray-900">
              Запись
            </Link>
          </nav>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-sm text-gray-500 hover:text-gray-900">
              Выйти ({session.user?.email})
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import BottomNav from "@/components/BottomNav";

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
            <Link href="/admin" className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-iqsmeta.svg" alt="IQ Smeta" className="h-7 w-auto" />
            </Link>
            {/* верхние ссылки — только на десктопе; на мобиле они в нижнем таб-баре */}
            <Link href="/admin/price" className="hidden text-gray-600 hover:text-gray-900 sm:inline">
              Прайс
            </Link>
            <Link href="/admin/estimates" className="hidden text-gray-600 hover:text-gray-900 sm:inline">
              Сметы
            </Link>
            <Link href="/record" className="hidden text-gray-600 hover:text-gray-900 sm:inline">
              Запись
            </Link>
            <Link href="/admin/synonyms" className="hidden text-gray-600 hover:text-gray-900 sm:inline">
              Синонимы
            </Link>
            <Link href="/admin/settings" className="hidden text-gray-600 hover:text-gray-900 sm:inline">
              Настройки
            </Link>
          </nav>
          <form
            className="shrink-0"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-sm text-gray-500 hover:text-gray-900">
              Выйти <span className="hidden sm:inline">({session.user?.email})</span>
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:pb-6">{children}</main>
      <BottomNav />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Нижний таб-бар для мобильных (как в приложении). На десктопе скрыт (sm:hidden).
const ITEMS = [
  { href: "/admin", label: "Панель", icon: HomeIcon, exact: true },
  { href: "/admin/price", label: "Прайс", icon: ListIcon },
  { href: "/admin/estimates", label: "Сметы", icon: DocIcon },
  { href: "/record", label: "Запись", icon: MicIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {ITEMS.map((it) => {
          const active = it.exact
            ? pathname === it.href
            : pathname.startsWith(it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                active ? "text-gray-900" : "text-gray-400"
              }`}
            >
              <Icon active={active} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function base(active: boolean) {
  return {
    width: 22,
    height: 22,
    fill: "none",
    stroke: active ? "#111827" : "#9ca3af",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...base(active)}>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  );
}
function ListIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...base(active)}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" fill={active ? "#111827" : "#9ca3af"} stroke="none" />
      <circle cx="4" cy="12" r="1" fill={active ? "#111827" : "#9ca3af"} stroke="none" />
      <circle cx="4" cy="18" r="1" fill={active ? "#111827" : "#9ca3af"} stroke="none" />
    </svg>
  );
}
function DocIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...base(active)}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 13h6M9 17h6" />
    </svg>
  );
}
function MicIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...base(active)}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
    </svg>
  );
}

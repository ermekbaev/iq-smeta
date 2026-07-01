"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteEstimateButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Удалить смету безвозвратно?")) return;
    setBusy(true);
    const res = await fetch(`/api/estimate/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/estimates");
      router.refresh();
    } else {
      setBusy(false);
      alert("Не удалось удалить смету.");
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {busy ? "Удаляю…" : "Удалить"}
    </button>
  );
}

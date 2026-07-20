import SynonymsManager from "./SynonymsManager";
import { isCurrentUserGlobalAdmin } from "@/lib/auth-helpers";

export default async function SynonymsPage() {
  const isMaintainer = await isCurrentUserGlobalAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Синонимы</h1>
      <SynonymsManager isMaintainer={isMaintainer} />
    </div>
  );
}

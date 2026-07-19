import SynonymsManager from "./SynonymsManager";
import { isCurrentUserGlobalAdmin } from "@/lib/auth-helpers";
import { aiHelperAvailable } from "@/lib/match/synonyms-ai";

export default async function SynonymsPage() {
  const isMaintainer = await isCurrentUserGlobalAdmin();
  const aiAvailable = aiHelperAvailable();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Синонимы</h1>
      <SynonymsManager isMaintainer={isMaintainer} aiAvailable={aiAvailable} />
    </div>
  );
}

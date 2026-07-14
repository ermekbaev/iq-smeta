import SynonymsManager from "./SynonymsManager";

export default function SynonymsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Синонимы</h1>
      <SynonymsManager />
    </div>
  );
}

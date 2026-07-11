"use client";

import { useRef } from "react";

/**
 * Кнопка загрузки файла вместо голого <input type="file">.
 * Прячет системный инпут, показывает понятную кликабельную кнопку-зону.
 */
export default function UploadButton({
  accept,
  onFile,
  label = "Загрузить файл",
  className = "",
}: {
  accept?: string;
  onFile: (file: File) => void;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-500 hover:bg-gray-50 ${className}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = ""; // разрешить повторный выбор того же файла
        }}
      />
    </>
  );
}

"use client";

import { useRef, useState, type DragEvent } from "react";
import clsx from "clsx";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function DropZone({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={clsx(
        "rounded-xl border-2 border-dashed p-12 text-center transition cursor-pointer",
        dragOver
          ? "border-slate-900 bg-slate-100"
          : "border-slate-300 bg-white hover:border-slate-400",
        disabled && "opacity-60 pointer-events-none"
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="text-base font-medium text-slate-900">
          Drop your Marketplace transactions CSV
        </div>
        <div className="text-sm text-slate-500">
          or <span className="underline">browse</span> to choose a file
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

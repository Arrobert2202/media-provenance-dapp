import { useRef, useState } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"];

export default function ImageDropzone({ onFile, preview, label = "Drop image here or click to browse", disabled = false }) {
  const inputRef   = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert("Please select a valid image file (JPEG, PNG, WEBP, BMP, TIFF).");
      return;
    }
    onFile(file);
  }

  function onInputChange(e) {
    handleFile(e.target.files?.[0] ?? null);
    e.target.value = "";
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) handleFile(e.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Image upload area"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={[
        "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all cursor-pointer select-none overflow-hidden min-h-[220px]",
        disabled
          ? "opacity-50 cursor-not-allowed border-slate-700 bg-slate-900"
          : dragging
          ? "border-brand-400 bg-brand-900/20 scale-[1.01]"
          : preview
          ? "border-slate-700 bg-slate-900 hover:border-slate-500"
          : "border-slate-700 bg-slate-900 hover:border-brand-500 hover:bg-slate-800/60",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        onChange={onInputChange}
        disabled={disabled}
        aria-hidden="true"
      />

      {preview ? (
        <>
          <img src={preview} alt="Selected image preview" className="w-full h-full object-contain max-h-64 p-2" />
          <span className="absolute bottom-2 right-2 bg-slate-800/80 text-slate-300 text-xs px-2 py-1 rounded-md backdrop-blur">
            Click to change
          </span>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 p-8 text-center pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M3.75 3h16.5M3.75 3A.75.75 0 003 3.75v13.5c0 .414.336.75.75.75h16.5a.75.75 0 00.75-.75V3.75A.75.75 0 0020.25 3H3.75z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-xs text-slate-600">JPEG · PNG · WEBP · BMP · TIFF — max 20 MB</p>
        </div>
      )}
    </div>
  );
}

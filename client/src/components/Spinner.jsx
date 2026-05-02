export default function Spinner({ label = "Loading…", size = "w-8 h-8" }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col items-center gap-3">
      <svg className={`${size} animate-spin-slow text-brand-500`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm text-slate-400">{label}</span>
    </div>
  );
}

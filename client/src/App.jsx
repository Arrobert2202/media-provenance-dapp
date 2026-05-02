import { useState } from "react";
import JournalistPortal from "./components/JournalistPortal.jsx";
import VerifyPortal     from "./components/VerifyPortal.jsx";

const TABS = [
  {
    id   : "journalist",
    label: "Journalist Portal",
    icon : (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id   : "verify",
    label: "Public Verification",
    icon : (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("journalist");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none text-white tracking-tight">ImageTrace</h1>
            <p className="text-xs text-slate-400 mt-0.5">Image Traceability</p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-brand-500 text-brand-400"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600",
                ].join(" ")}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        {activeTab === "journalist" && <JournalistPortal />}
        {activeTab === "verify"     && <VerifyPortal />}
      </main>

      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
        ImageTrace — Decentralised Image Traceability
      </footer>
    </div>
  );
}

import { useState, useCallback } from "react";
import axios from "axios";
import ImageDropzone from "./ImageDropzone.jsx";
import Spinner       from "./Spinner.jsx";

function VerifiedCard({ data }) {
  const { record, phash, distance } = data;
  const anchoredDate = new Date(record.timestamp * 1000).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "medium" });
  const [ctxDate, ctxLocation, ctxDescription] = record.context.split("|").map((s) => s.trim());

  return (
    <div className="animate-fade-in-up mt-8 rounded-2xl border border-emerald-700/50 bg-emerald-950/30 p-6 shadow-lg shadow-emerald-900/20">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-emerald-300">Verified Image ✓</h2>
          <p className="text-sm text-emerald-600 mt-0.5">
            {distance === 0
              ? "Exact match found in the blockchain registry."
              : `Close match found (Hamming distance: ${distance} bits). The image was likely compressed.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InfoRow label="Source (Author)" value={record.author} mono />
        <InfoRow label="Anchored At" value={anchoredDate} />
        {ctxDate        && <InfoRow label="Event Date" value={ctxDate} />}
        {ctxLocation    && <InfoRow label="Location" value={ctxLocation} />}
        {ctxDescription && <InfoRow label="Original Description" value={ctxDescription} className="sm:col-span-2" />}
        <InfoRow label="Uploaded Image pHash" value={phash} mono className="sm:col-span-2" />
        <InfoRow label="Registered pHash" value={record.phash} mono className="sm:col-span-2" />
      </div>

      <p className="mt-5 text-xs text-emerald-700 border-t border-emerald-800/50 pt-4">
        Simulated verification. In production, the record would be read directly from <code className="font-mono">ImageRegistry.sol</code>.
      </p>
    </div>
  );
}

function InfoRow({ label, value, mono = false, className = "" }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</dt>
      <dd className={`text-sm break-all ${mono ? "font-mono text-emerald-300" : "text-slate-200"}`}>{value}</dd>
    </div>
  );
}

/** @param {{ phash: string }} props */
function DisinformationWarning({ phash }) {
  return (
    <div className="animate-fade-in-up mt-8 rounded-2xl border-2 border-red-600/70 bg-red-950/40 p-6 shadow-lg shadow-red-900/30">
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-shrink-0 w-14 h-14 rounded-full bg-red-600/20 border-2 border-red-600/50 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <p className="text-xl font-bold text-red-400 leading-snug">Unverified image.</p>
          <p className="text-xl font-bold text-red-400 leading-snug">Unknown source.</p>
          <p className="text-xl font-bold text-red-400 leading-snug">High risk of disinformation.</p>
        </div>
      </div>

      <div className="bg-red-900/20 rounded-xl p-4 border border-red-800/40 mb-4">
        <p className="text-sm text-red-300 leading-relaxed">
          The visual fingerprint of this image <strong>was not found</strong> in the blockchain registry.
          This may mean the image has been significantly altered, originates from an unregistered source,
          or has been fabricated.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">pHash calculat</span>
        <span className="font-mono text-sm text-red-400 break-all">{phash}</span>
      </div>

      <p className="mt-4 text-xs text-red-800">
        Simulated verification. In production, the lookup would be performed directly on the blockchain via <code className="font-mono">ImageRegistry.sol</code>.
      </p>
    </div>
  );
}

export default function VerifyPortal() {
  const [file,    setFile]    = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);

  const handleFile = useCallback((selectedFile) => {
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setResult(null);
  }, []);

  async function handleVerify(e) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const { data } = await axios.post("/api/verify", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(data.verified ? { type: "verified", data } : { type: "unverified", phash: data.phash });
    } catch (err) {
      setResult({ type: "error", message: err.response?.data?.error ?? err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="verify-heading">
      <div className="mb-8">
        <h2 id="verify-heading" className="text-2xl font-bold text-white">Public Verification Portal</h2>
        <p className="text-slate-400 mt-1 text-sm">
          Upload a suspicious image to check whether its visual fingerprint matches a registered original.
        </p>
      </div>

      <form onSubmit={handleVerify} noValidate className="max-w-xl">
        <div className="flex flex-col gap-4">
          <label className="text-sm font-medium text-slate-300">Suspicious Image <span className="text-red-400">*</span></label>
          <ImageDropzone onFile={handleFile} preview={preview} label="Drop the suspicious image here (e.g. received via WhatsApp)" disabled={loading} />
          {file && <p className="text-xs text-slate-500 truncate">Selected: <span className="text-slate-300">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)</p>}

          <button
            type="submit"
            disabled={!file || loading}
            className="flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin-slow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verifying…
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
                </svg>
                Verify Image
              </>
            )}
          </button>
        </div>
      </form>

      {!result && !loading && (
        <div className="mt-10 max-w-xl rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">How it works</h3>
          <ol className="flex flex-col gap-2 text-sm text-slate-500 list-decimal list-inside">
            <li>Your image is sent to the cloud processing layer.</li>
            <li>A perceptual hash (pHash) is computed — a 256-bit visual fingerprint.</li>
            <li>The hash is compared against all records in the blockchain registry.</li>
            <li>Even WhatsApp-compressed versions of the original will match (Hamming distance ≤ 10).</li>
            <li>If no match is found, the image is flagged as unverified.</li>
          </ol>
        </div>
      )}

      {loading && (
        <div className="mt-10 flex justify-center">
          <Spinner label="Verifying…" size="w-10 h-10" />
        </div>
      )}

      {result?.type === "verified"   && <VerifiedCard data={result.data} />}
      {result?.type === "unverified" && <DisinformationWarning phash={result.phash} />}
      {result?.type === "error"      && (
        <div className="animate-fade-in-up mt-8 rounded-xl border border-red-700/50 bg-red-950/30 p-5 flex gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p className="font-semibold text-red-300 text-sm">Verification Failed</p>
            <p className="text-red-500 text-sm mt-1">{result.message}</p>
          </div>
        </div>
      )}
    </section>
  );
}

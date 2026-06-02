import { useState, useCallback } from "react";
import axios from "axios";
import ImageDropzone from "./ImageDropzone.jsx";
import Spinner       from "./Spinner.jsx";

function CertificateCard({ data }) {
  const date = new Date(data.timestamp * 1000).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "medium" });
  return (
    <div className="animate-fade-in-up mt-8 rounded-2xl border border-emerald-700/50 bg-emerald-950/40 p-6 shadow-lg shadow-emerald-900/20">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.745 3.745 0 013.296-1.043A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-emerald-300">Certificate of Authenticity</h2>
          <p className="text-sm text-emerald-600 mt-0.5">Image successfully anchored on the blockchain registry</p>
        </div>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Perceptual Hash (pHash)" value={data.phash} mono />
        <Field label="Author Wallet" value={data.author} mono />
        <Field label="Anchored At" value={date} />
        <Field label="Block Number" value={`#${data.blockNumber.toLocaleString()}`} mono />
        <Field label="Transaction Hash" value={data.txHash} mono className="sm:col-span-2" />
        <Field label="Context" value={data.context} className="sm:col-span-2" />
      </dl>
      <p className="mt-5 text-xs text-emerald-700 border-t border-emerald-800/50 pt-4">
        Simulation of an on-chain record in <code className="font-mono">ImageRegistry.sol</code>.
        In production, the transaction hash is verifiable on Etherscan.
      </p>
    </div>
  );
}

function Field({ label, value, mono = false, className = "" }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</dt>
      <dd className={`text-sm text-slate-200 break-all ${mono ? "font-mono text-emerald-300" : ""}`}>{value}</dd>
    </div>
  );
}

/** @param {{ existing: object }} props */
function DuplicateCard({ existing }) {
  const date = new Date(existing.timestamp * 1000).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "medium" });
  return (
    <div className="animate-fade-in-up mt-8 rounded-2xl border border-amber-700/50 bg-amber-950/30 p-6">
      <div className="flex items-start gap-3 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div>
          <h3 className="font-semibold text-amber-300">Duplicate Detected</h3>
          <p className="text-sm text-amber-600 mt-0.5">This image (or a visually identical one) is already registered.</p>
        </div>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-slate-500 uppercase tracking-wider mb-1">Existing pHash</dt><dd className="font-mono text-amber-300 break-all">{existing.phash}</dd></div>
        <div><dt className="text-xs text-slate-500 uppercase tracking-wider mb-1">Original Author</dt><dd className="font-mono text-slate-300 break-all">{existing.author}</dd></div>
        <div><dt className="text-xs text-slate-500 uppercase tracking-wider mb-1">Anchored At</dt><dd className="text-slate-300">{date}</dd></div>
        <div><dt className="text-xs text-slate-500 uppercase tracking-wider mb-1">Context</dt><dd className="text-slate-300">{existing.context}</dd></div>
      </dl>
    </div>
  );
}

export default function JournalistPortal() {
  const [file,        setFile]        = useState(null);
  const [preview,     setPreview]     = useState(null);
  const [form,        setForm]        = useState({ date: "", location: "", description: "", wallet: "" });
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleFile = useCallback((selectedFile) => {
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setResult(null);
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function validate() {
    const errors = {};
    if (!file)                    errors.file        = "Please select an image.";
    if (!form.date.trim())        errors.date        = "Date is required.";
    if (!form.location.trim())    errors.location    = "Location is required.";
    if (!form.description.trim()) errors.description = "Description is required.";
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // validate required fields before doing anything
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setLoading(true);
    setResult(null);

    // build the multipart payload — image file + combined context string
    const formData = new FormData();
    formData.append("image",   file);
    formData.append("context", `${form.date} | ${form.location} | ${form.description}`);
    if (form.wallet.trim()) formData.append("author", form.wallet.trim());

    console.log("[anchor] submitting image:", file.name, `(${(file.size / 1024).toFixed(1)} KB)`);
    console.log("[anchor] context:", `${form.date} | ${form.location} | ${form.description}`);

    try {
      // POST to backend — python computes phash, then contract is called
      const { data } = await axios.post("/api/anchor", formData, { headers: { "Content-Type": "multipart/form-data" } });

      console.log("[anchor] success! phash:", data.phash);
      console.log("[anchor] tx hash:", data.txHash, "| block:", data.blockNumber);

      setResult({ type: "success", data });
    } catch (err) {
      const resp = err.response?.data;
      if (resp?.duplicate) {
        // image already registered — show existing record
        console.warn("[anchor] duplicate detected:", resp.existing?.phash);
        setResult({ type: "duplicate", data: resp.existing });
      } else {
        console.error("[anchor] error:", resp?.error ?? err.message);
        setResult({ type: "error", message: resp?.error ?? err.message });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="journalist-heading">
      <div className="mb-8">
        <h2 id="journalist-heading" className="text-2xl font-bold text-white">Journalist Portal</h2>
        <p className="text-slate-400 mt-1 text-sm">
          Anchor the perceptual hash of an original photograph on the blockchain registry.
          Only the hash is stored — the physical image never leaves your device.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-slate-300">Original Photograph <span className="text-red-400">*</span></label>
          <ImageDropzone onFile={handleFile} preview={preview} label="Drop the original high-quality photo here" disabled={loading} />
          {fieldErrors.file && <p className="text-xs text-red-400">{fieldErrors.file}</p>}
          {file && <p className="text-xs text-slate-500 truncate">Selected: <span className="text-slate-300">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)</p>}
        </div>

        <div className="flex flex-col gap-5">
          <FormField label="Date & Time" name="date" type="datetime-local" value={form.date} onChange={handleChange} error={fieldErrors.date} disabled={loading} required />
          <FormField label="Location" name="location" placeholder="e.g. Piața Victoriei, Bucharest" value={form.location} onChange={handleChange} error={fieldErrors.location} disabled={loading} required />
          <FormField label="Description" name="description" placeholder="Brief description of the scene or event" value={form.description} onChange={handleChange} error={fieldErrors.description} disabled={loading} required multiline />
          <FormField label="Journalist Wallet Address" name="wallet" placeholder="0x… (optional — auto-generated if blank)" value={form.wallet} onChange={handleChange} disabled={loading} mono />

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin-slow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Computing pHash &amp; Anchoring…
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                Anchor Image on Blockchain
              </>
            )}
          </button>
        </div>
      </form>

      {loading && (
        <div className="mt-10 flex justify-center">
          <Spinner label="Anchoring…" size="w-10 h-10" />
        </div>
      )}

      {result?.type === "success"   && <CertificateCard data={result.data} />}
      {result?.type === "duplicate" && <DuplicateCard existing={result.data} />}
      {result?.type === "error"     && (
        <div className="animate-fade-in-up mt-8 rounded-xl border border-red-700/50 bg-red-950/30 p-5 flex gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p className="font-semibold text-red-300 text-sm">Anchoring Failed</p>
            <p className="text-red-500 text-sm mt-1">{result.message}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function FormField({ label, name, type = "text", placeholder, value, onChange, error, disabled, required, multiline, mono }) {
  const baseClass = [
    "w-full rounded-lg border bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600",
    "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    error ? "border-red-600" : "border-slate-700 hover:border-slate-600",
    mono ? "font-mono" : "",
  ].join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-slate-300">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {multiline ? (
        <textarea id={name} name={name} rows={3} placeholder={placeholder} value={value} onChange={onChange} disabled={disabled} required={required} className={baseClass + " resize-none"} />
      ) : (
        <input id={name} name={name} type={type} placeholder={placeholder} value={value} onChange={onChange} disabled={disabled} required={required} className={baseClass} />
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

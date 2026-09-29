"use client";
import { useRef, useState } from "react";
import { uploadImage } from "@/lib/actions/upload";

export default function ImageUploadField({
  name,
  defaultValue,
  label,
}: {
  name: string;
  defaultValue?: string;
  label: string;
}) {
  const [url, setUrl] = useState(defaultValue || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadImage(fd);
    setUploading(false);
    if (res.error) { setError(res.error); return; }
    setUrl(res.url || "");
  }

  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3 flex-wrap">
        {url && <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border line" />}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-4 h-10 rounded-full border line text-sm disabled:opacity-60"
        >
          {uploading ? "در حال آپلود…" : url ? "تغییر عکس" : "آپلود عکس از گوشی/کامپیوتر"}
        </button>
        {url && (
          <button type="button" onClick={() => setUrl("")} className="text-xs muted">حذف عکس</button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {error && <p className="text-xs mt-1" style={{ color: "#a24e56" }}>{error}</p>}
    </div>
  );
}

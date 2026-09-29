"use client";
import { useRef, useState } from "react";
import { uploadImage } from "@/lib/actions/upload";

export default function MultiImageUploadField({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string[];
}) {
  const [urls, setUrls] = useState<string[]>(defaultValue || []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError("");
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadImage(fd);
      if (res.error) setError(res.error);
      else if (res.url) setUrls((prev) => [...prev, res.url as string]);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(i: number) {
    setUrls((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <label className="text-sm font-medium block mb-1">تصاویر محصول (اولین عکس، تصویر اصلی است)</label>
      <input type="hidden" name={name} value={urls.join("\n")} />
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-3">
          {urls.map((u, i) => (
            <div key={u + i} className="relative">
              <img src={u} alt="" className="w-20 h-20 rounded-lg object-cover border line" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute -top-2 -left-2 w-6 h-6 rounded-full surface border line text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="px-4 h-10 rounded-full border line text-sm disabled:opacity-60"
      >
        {uploading ? "در حال آپلود…" : "+ افزودن عکس از گوشی/کامپیوتر"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      {error && <p className="text-xs mt-1" style={{ color: "#a24e56" }}>{error}</p>}
    </div>
  );
}

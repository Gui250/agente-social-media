"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export type UploadedMedia = { id: string; kind: "image" | "video"; previewUrl: string };

const ACCEPT = "image/jpeg,video/mp4,video/quicktime";

export function MediaUploader({
  value,
  onChange,
  disabled,
}: {
  value: UploadedMedia[];
  onChange: (media: UploadedMedia[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const added: UploadedMedia[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!ACCEPT.split(",").includes(file.type)) {
          throw new Error(`${file.name}: envie imagem JPEG ou vídeo MP4/MOV.`);
        }
        // Presigned PUT straight to the bucket, then the server checks and registers the file.
        const { storagePath, uploadUrl } = await api<{ storagePath: string; uploadUrl: string }>(
          "/api/media/upload-url",
          { body: { mimeType: file.type } },
        );
        const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!res.ok) throw new Error(`${file.name}: falha no envio (${res.status}).`);
        const media = await api<{ id: string; kind: "image" | "video" }>("/api/media", {
          body: { storagePath },
        });
        added.push({ ...media, previewUrl: URL.createObjectURL(file) });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      onChange([...value, ...added]);
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((m, i) => (
            <li key={m.id} className="relative">
              {m.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img src={m.previewUrl} alt={`Mídia ${i + 1}`} className="size-16 rounded-md object-cover" />
              ) : (
                <video src={m.previewUrl} className="size-16 rounded-md object-cover" muted aria-label={`Vídeo ${i + 1}`} />
              )}
              <button
                type="button"
                aria-label={`Remover mídia ${i + 1}`}
                className="absolute -top-1 -right-1 rounded-full bg-background px-1 text-xs shadow"
                onClick={() => onChange(value.filter((v) => v.id !== m.id))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || uploading}
        onClick={() => input.current?.click()}
      >
        {uploading ? "Enviando…" : "Anexar mídia"}
      </Button>
    </div>
  );
}

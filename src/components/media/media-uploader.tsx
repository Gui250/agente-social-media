"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";

export type UploadedMedia = { id: string; kind: "image" | "video"; previewUrl: string };

const ACCEPT = "image/jpeg,video/mp4,video/quicktime";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "video/mp4": "mp4", "video/quicktime": "mov" };

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
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const added: UploadedMedia[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!EXT[file.type]) throw new Error(`${file.name}: envie imagem JPEG ou vídeo MP4/MOV.`);
        const path = `${data.user?.id}/${crypto.randomUUID()}.${EXT[file.type]}`;
        const { error } = await supabase.storage
          .from("post-media")
          .upload(path, file, { contentType: file.type });
        if (error) throw new Error(`${file.name}: falha no envio (${error.message}).`);
        const media = await api<{ id: string; kind: "image" | "video" }>("/api/media", {
          body: { storagePath: path },
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

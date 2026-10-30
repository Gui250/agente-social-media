"use client";

import { ImageIcon, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/api-client";

type AssetType = "logo" | "logo_alt" | "other";
type Asset = { id: string; assetType: AssetType; width: number; height: number; url: string };

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const LABELS: Record<AssetType, string> = { logo: "Logo", logo_alt: "Logo alternativo", other: "Outro" };
const MAX_EXTRA = 5;

// Same three steps as media-uploader.tsx: signed PUT, upload straight to the store, server check.
async function upload(brandId: string, file: File, assetType: AssetType) {
  if (!ACCEPT.includes(file.type)) throw new Error(`${file.name}: envie uma imagem PNG, JPEG ou WebP.`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name}: a imagem passa de 10 MB.`);
  const { storageKey, uploadUrl } = await api<{ storageKey: string; uploadUrl: string }>(
    `/api/brands/${brandId}/assets/upload-url`,
    { body: { mimeType: file.type } },
  );
  const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!res.ok) throw new Error(`${file.name}: falha no envio (${res.status}).`);
  await api(`/api/brands/${brandId}/assets`, { body: { storageKey, assetType } });
}

export function BrandAssets({ brandId, assets }: { brandId: string; assets: Asset[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<AssetType>("logo");
  const [extraType, setExtraType] = useState<Exclude<AssetType, "logo">>("logo_alt");
  const [pending, setPending] = useState(false);

  const logo = assets.find((a) => a.assetType === "logo");
  const extras = assets.filter((a) => a.assetType !== "logo");

  function pick(assetType: AssetType) {
    setTarget(assetType);
    input.current?.click();
  }

  async function send(file: File) {
    setPending(true);
    try {
      await upload(brandId, file, target);
      toast.success(target === "logo" ? "Logo salvo." : "Arquivo enviado.");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(asset: Asset) {
    setPending(true);
    try {
      await api(`/api/brands/${brandId}/assets/${asset.id}`, { method: "DELETE" });
      toast.success(`${LABELS[asset.assetType]} excluído.`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <input
        ref={input}
        type="file"
        accept={ACCEPT.join(",")}
        className="sr-only"
        aria-label="Arquivo de imagem"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) send(f);
        }}
      />
      <div className="grid gap-3">
        <h3 className="text-sm font-medium">Logo</h3>
        {/* Checkerboard behind the logo so transparent and white logos stay visible. */}
        <div className="grid aspect-[3/2] place-items-center rounded-lg border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from the private store
            <img src={logo.url} alt="Logo da marca" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="grid justify-items-center gap-1 text-sm text-muted-foreground">
              <ImageIcon className="size-5" strokeWidth={1.5} aria-hidden />
              Nenhum logo enviado
            </span>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => pick("logo")}>
          <Upload strokeWidth={1.75} aria-hidden />
          {pending && target === "logo" ? "Enviando…" : logo ? "Trocar logo" : "Enviar logo"}
        </Button>
        <p className="text-xs text-muted-foreground">PNG, JPEG ou WebP, até 10 MB, de 64 a 8000 pixels por lado.</p>
      </div>
      <div className="grid gap-2">
        <h3 className="text-sm font-medium">Outros arquivos</h3>
        {extras.length > 0 && (
          <ul className="grid grid-cols-3 gap-3">
            {extras.map((a) => (
              <li key={a.id} className="grid gap-1 text-center text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                <img src={a.url} alt={LABELS[a.assetType]} className="aspect-square w-full rounded-md border object-contain p-1" />
                <span className="text-muted-foreground">{LABELS[a.assetType]}</span>
                <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={() => remove(a)}>
                  Excluir
                </Button>
              </li>
            ))}
          </ul>
        )}
        {extras.length < MAX_EXTRA ? (
          <div className="flex items-center gap-2">
            <NativeSelect
              aria-label="Tipo do arquivo"
              className="min-w-0 flex-1"
              value={extraType}
              onChange={(e) => setExtraType(e.target.value as Exclude<AssetType, "logo">)}
            >
              <option value="logo_alt">{LABELS.logo_alt}</option>
              <option value="other">{LABELS.other}</option>
            </NativeSelect>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => pick(extraType)}>
              <Upload strokeWidth={1.75} aria-hidden />
              {pending && target !== "logo" ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Limite de {MAX_EXTRA} arquivos além do logo.</p>
        )}
      </div>
    </div>
  );
}

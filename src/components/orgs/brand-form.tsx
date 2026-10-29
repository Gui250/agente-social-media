"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";

type ColorRole = "primary" | "secondary" | "accent" | "background" | "text" | "other";
type FontUsage = "heading" | "subheading" | "body" | "other";
type Color = { hex: string; role: ColorRole };
type Font = { family: string; usage: FontUsage };

export type BrandFormValue = {
  id: string;
  organizationSlug: string;
  name: string;
  description: string | null;
  industry: string | null;
  targetAudience: string | null;
  brandVoice: string | null;
  colorPalette: Color[];
  typography: Font[];
  visualGuidelines: string[];
  forbiddenElements: string[];
};

type Texts = Pick<BrandFormValue, "name" | "description" | "industry" | "targetAudience" | "brandVoice">;

const TEXT_FIELDS: { key: keyof Texts; label: string; max: number; long?: boolean }[] = [
  { key: "name", label: "Nome", max: 80 },
  { key: "industry", label: "Segmento", max: 120 },
  { key: "description", label: "Descrição", max: 1000, long: true },
  { key: "targetAudience", label: "Público-alvo", max: 500, long: true },
  { key: "brandVoice", label: "Tom de voz", max: 500, long: true },
];

const ROLES: Record<ColorRole, string> = {
  primary: "Primária",
  secondary: "Secundária",
  accent: "Destaque",
  background: "Fundo",
  text: "Texto",
  other: "Outra",
};
const USAGES: Record<FontUsage, string> = { heading: "Título", subheading: "Subtítulo", body: "Texto", other: "Outro" };
const MAX_COLORS = 10;
const MAX_FONTS = 5;
const HEX = /^#[0-9a-fA-F]{6}$/;

// What the form edits. Guidelines and forbidden elements are edited one item per line.
type Draft = Record<keyof Texts, string> & {
  colorPalette: Color[];
  typography: Font[];
  visualGuidelines: string;
  forbiddenElements: string;
};

const draftOf = (b: BrandFormValue): Draft => ({
  name: b.name,
  description: b.description ?? "",
  industry: b.industry ?? "",
  targetAudience: b.targetAudience ?? "",
  brandVoice: b.brandVoice ?? "",
  colorPalette: b.colorPalette,
  typography: b.typography,
  visualGuidelines: b.visualGuidelines.join("\n"),
  forbiddenElements: b.forbiddenElements.join("\n"),
});

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const payloadOf = (d: Draft) => ({
  ...d,
  visualGuidelines: lines(d.visualGuidelines),
  forbiddenElements: lines(d.forbiddenElements),
});

export function BrandForm({ brand }: { brand: BrandFormValue }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => draftOf(brand));
  const [draft, setDraft] = useState(saved);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  // Only what changed goes in the PATCH.
  const now = payloadOf(draft);
  const before = payloadOf(saved);
  const changes = Object.fromEntries(
    (Object.keys(now) as (keyof typeof now)[])
      .filter((k) => JSON.stringify(now[k]) !== JSON.stringify(before[k]))
      .map((k) => [k, now[k]]),
  );
  const dirty = Object.keys(changes).length > 0;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value });
  const setColor = (i: number, color: Partial<Color>) =>
    set(
      "colorPalette",
      draft.colorPalette.map((c, j) => (j === i ? { ...c, ...color } : c)),
    );
  const setFont = (i: number, font: Partial<Font>) =>
    set(
      "typography",
      draft.typography.map((f, j) => (j === i ? { ...f, ...font } : f)),
    );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const updated = await api<BrandFormValue>(`/api/brands/${brand.id}`, { method: "PATCH", body: changes });
      const next = draftOf(updated);
      setSaved(next);
      setDraft(next);
      toast.success("Marca salva.");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    try {
      await api(`/api/brands/${brand.id}`, { method: "DELETE" });
      toast.success(`Marca ${brand.name} excluída.`);
      router.push(`/empresas/${brand.organizationSlug}`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={save} className="grid gap-4">
        {TEXT_FIELDS.map(({ key, label, max, long }) => {
          const id = `brand-${key}`;
          const props = {
            id,
            value: draft[key],
            maxLength: max,
            required: key === "name",
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value),
          };
          return (
            <div key={key} className="grid gap-1.5">
              <Label htmlFor={id}>{label}</Label>
              {long ? <Textarea rows={3} {...props} /> : <Input {...props} />}
            </div>
          );
        })}
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Cores</legend>
          {draft.colorPalette.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Cor ${i + 1}`}
                value={HEX.test(c.hex) ? c.hex : "#000000"}
                onChange={(e) => setColor(i, { hex: e.target.value.toUpperCase() })}
                className="h-8 w-10 rounded border"
              />
              <Input
                aria-label={`Hexadecimal da cor ${i + 1}`}
                value={c.hex}
                onChange={(e) => setColor(i, { hex: e.target.value })}
                className="w-28"
                maxLength={7}
              />
              <NativeSelect
                aria-label={`Papel da cor ${i + 1}`}
                value={c.role}
                onChange={(e) => setColor(i, { role: e.target.value as ColorRole })}
                className="w-36"
              >
                {Object.entries(ROLES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  set(
                    "colorPalette",
                    draft.colorPalette.filter((_, j) => j !== i),
                  )
                }
              >
                Remover
              </Button>
            </div>
          ))}
          {draft.colorPalette.length < MAX_COLORS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() =>
                set("colorPalette", [
                  ...draft.colorPalette,
                  { hex: "#000000", role: draft.colorPalette.length ? "other" : "primary" },
                ])
              }
            >
              Adicionar cor
            </Button>
          )}
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Fontes</legend>
          {draft.typography.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                aria-label={`Nome da fonte ${i + 1}`}
                placeholder="Ex.: Montserrat"
                value={f.family}
                onChange={(e) => setFont(i, { family: e.target.value })}
                maxLength={80}
              />
              <NativeSelect
                aria-label={`Uso da fonte ${i + 1}`}
                value={f.usage}
                onChange={(e) => setFont(i, { usage: e.target.value as FontUsage })}
                className="w-36"
              >
                {Object.entries(USAGES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  set(
                    "typography",
                    draft.typography.filter((_, j) => j !== i),
                  )
                }
              >
                Remover
              </Button>
            </div>
          ))}
          {draft.typography.length < MAX_FONTS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() =>
                set("typography", [
                  ...draft.typography,
                  { family: "", usage: draft.typography.length ? "body" : "heading" },
                ])
              }
            >
              Adicionar fonte
            </Button>
          )}
        </fieldset>
        {(
          [
            ["visualGuidelines", "Diretrizes visuais", "Ex.: Fundo claro com bastante respiro"],
            ["forbiddenElements", "Elementos proibidos", "Ex.: Cores neon"],
          ] as const
        ).map(([key, label, placeholder]) => (
          <div key={key} className="grid gap-1.5">
            <Label htmlFor={`brand-${key}`}>{label}</Label>
            <Textarea
              id={`brand-${key}`}
              rows={4}
              placeholder={placeholder}
              value={draft[key]}
              onChange={(e) => set(key, e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Um item por linha (até 30, com até 500 caracteres cada).</p>
          </div>
        ))}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="destructive" className="ml-auto" onClick={() => setConfirming(true)}>
            Excluir marca
          </Button>
        </div>
      </form>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {brand.name}?</DialogTitle>
            <DialogDescription>
              O brand kit e os arquivos da marca também são excluídos. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { Plus, Trash2, X } from "lucide-react";
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

  const textField = (key: keyof Texts) => {
    const { label, max, long } = TEXT_FIELDS.find((f) => f.key === key)!;
    const id = `brand-${key}`;
    const props = {
      id,
      value: draft[key],
      maxLength: max,
      required: key === "name",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value),
    };
    return (
      <div key={key} className="grid gap-2">
        <Label htmlFor={id}>{label}</Label>
        {long ? <Textarea rows={3} {...props} /> : <Input {...props} />}
      </div>
    );
  };

  return (
    <>
      <form onSubmit={save} className="grid gap-4">
        <Panel title="Sobre a marca">
          <div className="grid gap-4 sm:grid-cols-2">
            {textField("name")}
            {textField("industry")}
          </div>
          {textField("description")}
          <div className="grid gap-4 sm:grid-cols-2">
            {textField("targetAudience")}
            {textField("brandVoice")}
          </div>
        </Panel>

        <Panel title="Cores" description="A primária vai nas artes geradas, junto com o logo.">
          {draft.colorPalette.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma cor cadastrada.</p>}
          {draft.colorPalette.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Cor ${i + 1}`}
                value={HEX.test(c.hex) ? c.hex : "#000000"}
                onChange={(e) => setColor(i, { hex: e.target.value.toUpperCase() })}
                className="size-9 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0"
              />
              <Input
                aria-label={`Hexadecimal da cor ${i + 1}`}
                value={c.hex}
                onChange={(e) => setColor(i, { hex: e.target.value })}
                className="w-28 font-mono uppercase"
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
              <RemoveButton
                label={`Remover cor ${i + 1}`}
                onClick={() =>
                  set(
                    "colorPalette",
                    draft.colorPalette.filter((_, j) => j !== i),
                  )
                }
              />
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
              <Plus strokeWidth={1.75} aria-hidden />
              Adicionar cor
            </Button>
          )}
        </Panel>

        <Panel title="Fontes">
          {draft.typography.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada.</p>}
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
              <RemoveButton
                label={`Remover fonte ${i + 1}`}
                onClick={() =>
                  set(
                    "typography",
                    draft.typography.filter((_, j) => j !== i),
                  )
                }
              />
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
              <Plus strokeWidth={1.75} aria-hidden />
              Adicionar fonte
            </Button>
          )}
        </Panel>

        <Panel title="Diretrizes" description="Um item por linha (até 30, com até 500 caracteres cada).">
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["visualGuidelines", "Diretrizes visuais", "Ex.: Fundo claro com bastante respiro"],
                ["forbiddenElements", "Elementos proibidos", "Ex.: Cores neon"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <div key={key} className="grid gap-2">
                <Label htmlFor={`brand-${key}`}>{label}</Label>
                <Textarea
                  id={`brand-${key}`}
                  rows={5}
                  placeholder={placeholder}
                  value={draft[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </Panel>

        {/* Stays in view while editing, so saving never needs a scroll to the bottom. */}
        <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t bg-background py-3">
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {dirty ? "Alterações não salvas" : "Tudo salvo"}
          </span>
          <Button
            type="button"
            variant="ghost"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2 strokeWidth={1.75} aria-hidden />
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

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <div className="grid gap-1">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick}>
      <X strokeWidth={1.75} aria-hidden />
    </Button>
  );
}

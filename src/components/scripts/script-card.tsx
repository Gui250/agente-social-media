import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreativeScript, ScriptFormat } from "@/models/creative-script";

export function ScriptCard({
  script,
  format,
  segment,
  actions,
}: {
  script: CreativeScript;
  format: ScriptFormat;
  segment: string;
  actions?: React.ReactNode;
}) {
  const video = format === "video";
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="gap-1.5 pt-4">
        <p className="text-xs text-muted-foreground">
          {segment}, {video ? "Reels" : script.blocks.length > 1 ? `carrossel de ${script.blocks.length} slides` : "post único"}
        </p>
        <CardTitle className="text-base leading-snug">{script.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 py-4 text-sm">
        <blockquote className="border-l-2 border-primary pl-3 text-[0.95rem] leading-snug font-medium">
          {script.hook}
        </blockquote>

        {/* The slides side by side, like the carousel they become; scrolls sideways when they don't fit. */}
        <ol
          aria-label={video ? "Cenas" : "Slides"}
          className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1"
        >
          {script.blocks.map((b, i) => (
            <li
              key={i}
              className="flex aspect-[4/5] w-40 shrink-0 snap-start flex-col gap-2 rounded-lg bg-muted p-3"
            >
              <span className="text-xs text-muted-foreground tabular-nums">
                {b.label}
                {b.durationSeconds !== null && `, ${b.durationSeconds}s`}
              </span>
              <p className="line-clamp-4 leading-snug font-semibold whitespace-pre-line">{b.text}</p>
              <p className="mt-auto line-clamp-3 text-xs leading-snug text-muted-foreground" title={b.visual}>
                {b.visual}
              </p>
            </li>
          ))}
        </ol>

        <details className="group rounded-lg border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium select-none">Legenda, CTA e hashtags</summary>
          <div className="grid gap-3 pt-3 pb-1">
            <p className="whitespace-pre-wrap text-muted-foreground">{script.caption}</p>
            <p>
              <span className="font-medium">CTA: </span>
              {script.cta}
            </p>
            <p className="text-primary">{script.hashtags.join(" ")}</p>
          </div>
        </details>
      </CardContent>
      {actions && <div className="flex flex-wrap gap-2 border-t px-4 py-3">{actions}</div>}
    </Card>
  );
}

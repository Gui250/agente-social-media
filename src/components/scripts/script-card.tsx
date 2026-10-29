import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>{script.title}</CardTitle>
        <CardDescription>
          {segment} · {format === "video" ? "Vídeo curto (Reels)" : "Post estático / carrossel"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <section>
          <h3 className="font-medium">Gancho</h3>
          <p>{script.hook}</p>
        </section>
        <section>
          <h3 className="font-medium">{format === "video" ? "Cenas" : "Slides"}</h3>
          <ol className="mt-1 grid gap-2">
            {script.blocks.map((b, i) => (
              <li key={i} className="rounded-md border p-2">
                <p className="font-medium">
                  {b.label}
                  {b.durationSeconds !== null && (
                    <span className="text-muted-foreground"> · {b.durationSeconds}s</span>
                  )}
                </p>
                <p className="text-muted-foreground">Visual: {b.visual}</p>
                <p>{b.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h3 className="font-medium">Legenda</h3>
          <p className="whitespace-pre-wrap">{script.caption}</p>
        </section>
        <section>
          <h3 className="font-medium">CTA</h3>
          <p>{script.cta}</p>
        </section>
        <div className="flex flex-wrap gap-1">
          {script.hashtags.map((h) => (
            <Badge key={h} variant="secondary">
              {h}
            </Badge>
          ))}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </CardContent>
    </Card>
  );
}

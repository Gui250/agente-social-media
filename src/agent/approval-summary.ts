import { formatInTimeZone } from "@/lib/datetime";

const TYPE_LABEL: Record<string, string> = { image: "imagem", carousel: "carrossel", reel: "Reels" };

type Args = {
  accountId?: string;
  postType?: string;
  caption?: string;
  mediaIds?: string[];
  scheduledAt?: string;
  postId?: string | null;
};

// Text shown on the confirmation card, built from the tool arguments (never from model prose).
export function summarize(
  toolName: string,
  rawArgs: string | undefined,
  {
    timezone,
    accounts,
    brandName,
  }: { timezone: string; accounts: { id: string; username: string }[]; brandName?: string | null },
) {
  let args: Args = {};
  try {
    args = JSON.parse(rawArgs ?? "{}");
  } catch {}

  if (toolName === "publish_post_now" && args.postId) return "Publicar agora o post selecionado";
  if (toolName === "generate_creative_media") {
    const cost = "Cada geração tem custo; artes reprovadas na revisão automática são refeitas uma vez.";
    return brandName
      ? `Gerar com IA as mídias do roteiro para a marca ${brandName}. ${cost}`
      : `Gerar com IA as mídias do roteiro (imagens ou vídeo). ${cost}`;
  }

  const username = accounts.find((a) => a.id === args.accountId)?.username ?? "conta desconhecida";
  const type = TYPE_LABEL[args.postType ?? ""] ?? args.postType ?? "post";
  const caption = (args.caption ?? "").replace(/\s+/g, " ");
  const preview = caption.length > 80 ? `${caption.slice(0, 80)}…` : caption;
  const media = `${args.mediaIds?.length ?? 0} mídia(s)`;

  if (toolName === "schedule_post") {
    const when = args.scheduledAt ? formatInTimeZone(args.scheduledAt, timezone) : "data não informada";
    return `Agendar ${type} em @${username} para ${when} — "${preview}" — ${media}`;
  }
  if (toolName === "publish_post_now") {
    return `Publicar agora ${type} em @${username} — "${preview}" — ${media}`;
  }
  return `Executar ${toolName}`;
}

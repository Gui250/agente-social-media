import type { CreativeScript } from "@/models/creative-script";

// forbidden: the active brand's forbidden elements (brand kit).
type Brand = { segment: string; forbidden?: string[] };

const forbiddenLine = (brand: Brand) => brand.forbidden?.length && `Não mostre: ${brand.forbidden.join("; ")}.`;

// What goes to the image model besides the prompt, in this order: the user's real photo (product,
// place, team) and then the reference creatives whose style the user wants.
type Inputs = { photo?: boolean; styles?: number };

// Pure: one block of the script → one image prompt. Conversion rules live here so every image
// gets them: hook on the first image, one focal point, no text drawn by the model (overlay.tsx adds
// it), room at the top for that text, and the script's art direction on every image so a carousel
// looks like one piece. The look comes from the style references or the art direction; only when
// neither sets one does it fall back to a real, unposed photo.
export function visualPrompt(script: CreativeScript, index: number, brand: Brand, inputs: Inputs = {}) {
  const block = script.blocks[index];
  const styles = inputs.styles ?? 0;
  return [
    `Imagem vertical para um anúncio de Instagram de um(a) ${brand.segment}, que precisa parar a rolagem.`,
    `Cena: ${block.visual}`,
    script.artDirection && `Direção de arte (a mesma em todas as imagens do post): ${script.artDirection}`,
    index === 0 && `Primeira imagem: precisa parar a rolagem. Ideia central: "${script.hook}".`,
    inputs.photo &&
      "A primeira imagem anexada é a foto real do cliente: mantenha o produto, o lugar ou as pessoas fiéis a ela (forma, cores, rótulo).",
    styles > 0 &&
      `${inputs.photo ? "As outras imagens anexadas são" : styles > 1 ? "As imagens anexadas são" : "A imagem anexada é"} referência de estilo do cliente: siga o tipo de imagem, a composição, a luz, a paleta, as texturas e o acabamento. Crie uma cena nova: não copie a cena, os textos, as marcas nem os logos.`,
    "Um único ponto focal, em forte contraste com o fundo. Siga o ângulo e o enquadramento da cena.",
    styles === 0 &&
      "Use o tipo de imagem da direção de arte (foto, produto em estúdio, 3D, ilustração). Se ela não definir, faça uma foto real feita no momento, num lugar brasileiro, com texturas reais.",
    "Nada de banco de imagens: sem pessoas posando e sorrindo para a câmera, sem pele de plástico, sem gradientes genéricos.",
    "Assunto na metade de baixo; terço superior com área limpa para texto sobreposto.",
    "Não mostre preços, promoções, resultados garantidos, antes e depois nem paciente ou resultado de tratamento.",
    forbiddenLine(brand),
    "Sem texto, letras, números, logotipos ou marcas d'água.",
  ]
    .filter(Boolean)
    .join("\n");
}

// The video model makes at most 12 s, so the script's scenes are compressed into one clip.
export function videoPrompt(script: CreativeScript, brand: Brand) {
  const scenes = script.blocks.map((b) => `- ${b.label}: ${b.visual}`).join("\n");
  return [
    `Vídeo vertical 9:16 para Reels de um(a) ${brand.segment}, filmado com celular, pessoas brasileiras.`,
    `O primeiro frame já está no meio da ação, com movimento ou contraste forte que traduza: "${script.hook}".`,
    `Sequência, comprimida em 12 segundos:\n${scenes}`,
    script.artDirection && `Direção de arte: ${script.artDirection}`,
    "Não mostre preços, promoções, resultados garantidos nem comparações de antes e depois.",
    forbiddenLine(brand),
    "Sem texto na tela, sem legendas, sem logotipos, sem vinheta de abertura.",
  ]
    .filter(Boolean)
    .join("\n");
}

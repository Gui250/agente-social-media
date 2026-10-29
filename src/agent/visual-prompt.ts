import type { CreativeScript } from "@/models/creative-script";

type Brand = { segment: string };

// Pure: one block of the script → one image prompt. Conversion rules live here so every image
// gets them: hook on the first image, one focal point, no stock-photo look, no text drawn by the
// model (overlay.tsx adds it), room at the top for that text, real-looking Brazilian places, and the
// script's art direction on every image so a carousel looks like one piece.
export function visualPrompt(script: CreativeScript, index: number, brand: Brand) {
  const block = script.blocks[index];
  return [
    `Foto vertical para um anúncio de Instagram de um(a) ${brand.segment}, que precisa parar a rolagem.`,
    `Cena: ${block.visual}`,
    script.artDirection && `Direção de arte (a mesma em todas as imagens do post): ${script.artDirection}`,
    index === 0 && `Primeira imagem: precisa parar a rolagem. Ideia central: "${script.hook}".`,
    "Um único ponto focal, em forte contraste com o fundo. Siga o ângulo e o enquadramento da cena.",
    "Parece uma foto real feita no momento, num lugar brasileiro, com texturas reais (poros, marcas de uso).",
    "Nada de banco de imagens: sem pessoas posando e sorrindo para a câmera, sem fundo liso de estúdio, sem pele de plástico.",
    "Assunto na metade de baixo; terço superior com área limpa para texto sobreposto.",
    "Não mostre preços, promoções, resultados garantidos, antes e depois nem paciente ou resultado de tratamento.",
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
    "Sem texto na tela, sem legendas, sem logotipos, sem vinheta de abertura.",
  ]
    .filter(Boolean)
    .join("\n");
}

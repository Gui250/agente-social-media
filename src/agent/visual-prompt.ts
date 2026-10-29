import type { CreativeScript } from "@/models/creative-script";

type Brand = { segment: string };

// Pure: one block of the script → one image prompt. Conversion rules live here so every image
// gets them: hook on the first image, one big subject, no text drawn by the model (overlay.tsx
// adds it), room at the top for that text, real-looking Brazilian people and places.
export function visualPrompt(script: CreativeScript, index: number, brand: Brand) {
  const block = script.blocks[index];
  return [
    `Foto publicitária vertical para Instagram de um(a) ${brand.segment}.`,
    `Cena: ${block.visual}`,
    index === 0 && `Primeira imagem: precisa parar a rolagem. Ideia central: "${script.hook}".`,
    "Um único assunto principal, grande e nítido, fundo simples, alto contraste.",
    "Pessoas e lugares brasileiros, luz natural, aparência de foto feita com um bom celular.",
    "Deixe o terço superior com área limpa para texto sobreposto.",
    "Não mostre preços, promoções, resultados garantidos nem comparações de antes e depois.",
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
    `No primeiro segundo, movimento ou contraste forte que traduza: "${script.hook}".`,
    `Sequência, comprimida em 12 segundos:\n${scenes}`,
    "Não mostre preços, promoções, resultados garantidos nem comparações de antes e depois.",
    "Sem texto na tela, sem legendas, sem logotipos.",
  ].join("\n");
}

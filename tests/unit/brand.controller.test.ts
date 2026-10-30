import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const run = vi.fn();
const getMediaForUser = vi.fn();
const readObject = vi.fn();

vi.mock("@openai/agents", async (orig) => ({ ...(await orig<typeof import("@openai/agents")>()), run }));
vi.mock("@/models/media", () => ({ getMediaForUser }));
vi.mock("@/lib/storage", () => ({ readObject }));

const { extractIdentity } = await import("@/controllers/brand");

describe("brand.extractIdentity", () => {
  beforeEach(() => {
    run.mockReset();
    getMediaForUser.mockReset();
    readObject.mockReset();
  });

  it("refuses a video before calling the model", async () => {
    getMediaForUser.mockResolvedValue([{ kind: "video", storage_path: "u1/v.mp4" }]);
    await expect(extractIdentity("u1", "m1")).rejects.toBeInstanceOf(DomainError);
    expect(run).not.toHaveBeenCalled();
  });

  it("sends the image to the model and keeps only valid hex colors", async () => {
    getMediaForUser.mockResolvedValue([{ kind: "image", storage_path: "u1/logo.jpg" }]);
    readObject.mockResolvedValue(new Uint8Array([1, 2, 3]));
    run.mockResolvedValue({
      finalOutput: {
        colors: [
          { hex: "#1a2b4c", name: "azul-marinho", role: "primária" },
          { hex: "azul", name: "azul", role: "destaque" },
        ],
        logo: "Dente estilizado",
        typography: "Sem serifa",
        style: "Limpo e confiável",
      },
    });
    const identity = await extractIdentity("u1", "m1");
    expect(getMediaForUser).toHaveBeenCalledWith(["m1"], "u1");
    expect(identity.colors).toEqual([{ hex: "#1A2B4C", name: "azul-marinho", role: "primária" }]);
    const [input] = run.mock.calls[0][1];
    expect(input.content[0]).toEqual({ type: "input_image", image: "data:image/jpeg;base64,AQID" });
  });
});

const { analyzeReferences } = await import("@/controllers/brand");

describe("brand.analyzeReferences", () => {
  beforeEach(() => {
    run.mockReset();
    getMediaForUser.mockReset();
    readObject.mockReset();
  });

  it("refuses more than 5 references before reading anything", async () => {
    await expect(analyzeReferences("u1", ["a", "b", "c", "d", "e", "f"])).rejects.toBeInstanceOf(DomainError);
    expect(getMediaForUser).not.toHaveBeenCalled();
  });

  it("refuses a video among the references", async () => {
    getMediaForUser.mockResolvedValue([
      { kind: "image", storage_path: "u1/a.jpg" },
      { kind: "video", storage_path: "u1/b.mp4" },
    ]);
    await expect(analyzeReferences("u1", ["a", "b"])).rejects.toBeInstanceOf(DomainError);
    expect(run).not.toHaveBeenCalled();
  });

  it("sends every reference image in one request and keeps only valid hex colors", async () => {
    getMediaForUser.mockResolvedValue([
      { kind: "image", storage_path: "u1/a.jpg" },
      { kind: "image", storage_path: "u1/b.jpg" },
    ]);
    readObject.mockResolvedValue(new Uint8Array([1, 2, 3]));
    run.mockResolvedValue({
      finalOutput: {
        pattern: "Close extremo",
        composition: "Produto no centro, texto no topo",
        imagery: "Foto real, luz dura",
        colors: [
          { hex: "#ff6600", name: "laranja" },
          { hex: "laranja", name: "laranja" },
        ],
        text: "Título de 5 palavras em negrito",
        hook: "Pergunta",
        common: "Fundo escuro",
      },
    });
    const style = await analyzeReferences("u1", ["a", "b", "a"]);
    expect(getMediaForUser).toHaveBeenCalledWith(["a", "b"], "u1");
    expect(style.colors).toEqual([{ hex: "#FF6600", name: "laranja" }]);
    const [input] = run.mock.calls[0][1];
    expect(input.content.filter((c: { type: string }) => c.type === "input_image")).toHaveLength(2);
  });
});

const { researchReferences } = await import("@/controllers/brand");

describe("brand.researchReferences", () => {
  beforeEach(() => {
    run.mockReset();
    getMediaForUser.mockReset();
    readObject.mockReset();
  });

  it("refuses a video before searching", async () => {
    getMediaForUser.mockResolvedValue([{ kind: "video", storage_path: "u1/v.mp4" }]);
    await expect(researchReferences("u1", ["v"], null)).rejects.toBeInstanceOf(DomainError);
    expect(run).not.toHaveBeenCalled();
  });

  it("sends the media and brief to a web-search agent and drops links that aren't URLs", async () => {
    getMediaForUser.mockResolvedValue([{ kind: "image", storage_path: "u1/produto.jpg" }]);
    readObject.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const recipe = {
      pattern: "Close extremo",
      composition: "Produto no centro",
      imagery: "Foto real",
      colors: [{ hex: "#00aa55", name: "verde" }, { hex: "verde", name: "verde" }],
      text: "Título curto",
      hook: "Afirmação ousada",
      common: "Fundo escuro",
    };
    run.mockResolvedValue({
      finalOutput: {
        subject: "Pote de açaí",
        references: [
          { title: "Campanha A — Agência X", url: "https://example.com/a", idea: "Fruta gigante" },
          { title: "Campanha B", url: "não encontrei", idea: "Textura" },
        ],
        recipe,
      },
    });
    const found = await researchReferences("u1", ["m1"], "  açaíteria, público jovem  ");
    expect(found.references.map((r) => r.url)).toEqual(["https://example.com/a"]);
    expect(found.recipe.colors).toEqual([{ hex: "#00AA55", name: "verde" }]);
    const [agent, [input], options] = run.mock.calls[0];
    expect(agent.tools.map((t: { name: string }) => t.name)).toContain("web_search");
    expect(options).toEqual({ maxTurns: 1 });
    expect(input.content[0]).toEqual({ type: "input_image", image: "data:image/jpeg;base64,AQID" });
    expect(input.content[1].text).toContain("Briefing: açaíteria, público jovem");
  });
});

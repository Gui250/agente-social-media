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

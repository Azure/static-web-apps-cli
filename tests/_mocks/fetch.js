// See https://stackoverflow.com/questions/75756917/how-to-mock-the-response-of-node-fetch-in-typescript-using-suoertest-and-vitest
import { vi } from "vitest";

vi.mock("node-fetch", async () => {
  const actual = await vi.importActual("node-fetch");
  return {
    ...actual,
    default: vi.fn(),
  };
});

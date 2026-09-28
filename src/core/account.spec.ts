import { WebSiteManagementClient } from "@azure/arm-appservice";
import { chooseOrCreateProjectDetails } from "./account.js";

const { listStaticSitesByResourceGroup, staticSite } = vi.hoisted(() => ({
  listStaticSitesByResourceGroup: vi.fn(),
  staticSite: {
    id: "/subscriptions/mock-subscription/resourceGroups/target-rg/providers/Microsoft.Web/staticSites/same-name",
    name: "same-name",
    provider: "SwaCli",
  },
}));

vi.mock("@azure/arm-appservice", () => ({
  WebSiteManagementClient: vi.fn(() => ({
    staticSites: {
      list: vi.fn(),
      listStaticSitesByResourceGroup,
    },
  })),
}));

vi.mock("./prompts.js", () => ({
  chooseProjectName: vi.fn(),
  chooseProjectSku: vi.fn(),
  chooseStaticSite: vi.fn(),
  wouldYouLikeToCreateStaticSite: vi.fn(),
  wouldYouLikeToOverrideStaticSite: vi.fn(),
}));

describe("chooseOrCreateProjectDetails", () => {
  beforeEach(() => {
    listStaticSitesByResourceGroup.mockReset();
    listStaticSitesByResourceGroup.mockReturnValue(
      (async function* () {
        yield staticSite;
      })(),
    );
  });

  it("looks up a named static site only in the specified resource group", async () => {
    const result = await chooseOrCreateProjectDetails(
      { appName: "same-name", resourceGroup: "target-rg" },
      {} as never,
      "mock-subscription",
      false,
    );

    expect(WebSiteManagementClient).toHaveBeenCalledWith(expect.anything(), "mock-subscription");
    expect(listStaticSitesByResourceGroup).toHaveBeenCalledWith("target-rg");
    expect(result).toEqual({ resourceGroup: "target-rg", staticSiteName: "same-name" });
  });
});

import { AzureFunction, HttpRequest } from "@azure/functions";
import { response } from "../../utils";
const SWA_EMU_HOST = "http://localhost:" + process.env.SWA_EMU_PORT;

const httpTrigger: AzureFunction = async function (context, _req: HttpRequest) {
  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthCookie",
        value: "deleted",
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: "localhost",
        expires: new Date(1970),
      },
      {
        name: "StaticWebAppsAuthContextCookie",
        value: "deleted",
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: "localhost",
        expires: new Date(1970),
      },
      {
        name: "StaticWebAppsAuthCookie__PROVIDER",
        value: "deleted",
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: "localhost",
        expires: new Date(1970),
      },
    ],
    headers: {
      location: SWA_EMU_HOST,
    },
  });
};

export default httpTrigger;

import { AzureFunction, HttpRequest } from "@azure/functions";
import { response } from "../../utils";
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `http://localhost:4242`;

const httpTrigger: AzureFunction = function (context, _req: HttpRequest) {
  const { provider } = context.bindingData;

  const location = `${SWA_EMU_AUTH_URI}/.redirect/${provider}?hostName=localhost&staticWebAppsAuthNonce=${context.invocationId}`;

  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthContextCookie",
        value: process.env.StaticWebAppsAuthContextCookie,
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: "localhost",
        SameSite: "None",
      },
      {
        name: "StaticWebAppsAuthCookie__PROVIDER",
        value: provider,
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: "localhost",
        SameSite: "None",
      },
    ],
    headers: {
      location,
    },
  });
};

export default httpTrigger;

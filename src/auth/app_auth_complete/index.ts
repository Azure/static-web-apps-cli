import { AzureFunction, HttpRequest } from "@azure/functions";
import { response } from "../../utils";
const SWA_EMU_HOST = "http://localhost:" + process.env.SWA_EMU_PORT;

const httpTrigger: AzureFunction = async function (context, req: HttpRequest) {
  const { post_login_redirect_uri = "" } = req.query;

  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthContextCookie",
        value: "deleted",
        path: "/",
        domain: "localhost",
        expires: new Date(1970),
      },
      {
        name: "StaticWebAppsAuthCookie",
        value: process.env.StaticWebAppsAuthCookie,
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: "localhost",
        SameSite: "Strict",
      },
    ],
    headers: {
      location: `${SWA_EMU_HOST}/${post_login_redirect_uri}`,
    },
  });
};

export default httpTrigger;

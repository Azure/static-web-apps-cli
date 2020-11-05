import { AzureFunction, HttpRequest } from "@azure/functions";
import { response } from "../../utils";
import qs from "querystring";

const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `http://localhost:4242`;

const httpTrigger: AzureFunction = async function (context, req: HttpRequest) {
  const { state } = req.query;
  const { redir = "" } = qs.parse(state);
  
  // This doesn't match the API, but we need to get the redir value across
  const location = `${SWA_EMU_AUTH_URI}/.auth/login/done?post_login_redirect_uri=${redir}`;

  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "Nonce",
        value: "deleted",
        path: "/",
        expires: new Date(1970),
      },
      {
        name: "RedirectCount",
        value: "deleted",
        path: "/",
        expires: new Date(1970),
      },
      {
        name: "AppServiceAuthSession",
        value: process.env.AppServiceAuthSession,
        path: "/",
        secure: false,
        HttpOnly: false,
        SameSite: "None",
      },
    ],
    headers: {
      location,
    },
  });
};

export default httpTrigger;

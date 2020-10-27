import { AzureFunction, HttpRequest } from "@azure/functions";
import { response } from "../../utils";
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `http://localhost:4242`;

const httpTrigger: AzureFunction = function (context, req: HttpRequest) {
  let { state, code, nonce } = req.query;

  const location = `${SWA_EMU_AUTH_URI}/.auth/login/done`;
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

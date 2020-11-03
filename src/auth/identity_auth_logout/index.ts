import { AzureFunction, HttpRequest } from "@azure/functions";
import { response } from "../../utils";
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `http://localhost:4242`;

const httpTrigger: AzureFunction = async function (context, _req: HttpRequest) {
  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "AppServiceAuthSession",
        value: "deleted",
        path: "/",
        secure: false,
        HttpOnly: false,
        expires: new Date(1970),
      },
    ],
    headers: {
      location: `${SWA_EMU_AUTH_URI}/.auth/logout/complete`,
    },
  });
};

export default httpTrigger;

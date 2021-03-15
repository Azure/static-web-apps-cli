import { IncomingMessage } from "http";
import { decodeCookie, response, validateCookie } from "../../core/utils";

const httpTrigger = async function (context: Context, req: IncomingMessage) {
  const { cookie } = req.headers;

  if (!cookie || !validateCookie(cookie)) {
    context.res = response({
      context,
      status: 200,
      body: {
        clientPrincipal: null,
      },
    });
    return;
  }

  const clientPrincipal = decodeCookie(cookie);

  if (clientPrincipal?.userRoles.includes("authenticated") === false) {
    clientPrincipal?.userRoles.push("authenticated");
  }

  context.res = response({
    context,
    status: 200,
    body: {
      clientPrincipal,
    },
  });
};

export default httpTrigger;

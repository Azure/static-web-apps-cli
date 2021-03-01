import { decodeCookie, response, validateCookie } from "../../core/utils";

const httpTrigger = async function (context: Context, req: ServerRequest) {
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

  context.res = response({
    context,
    status: 200,
    body: {
      clientPrincipal,
    },
  });
};

export default httpTrigger;

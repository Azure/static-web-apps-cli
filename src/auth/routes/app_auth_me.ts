
import { response, validateCookie } from "../../utils";
import { currentUser } from "../../userManager";

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

  const user = currentUser(cookie);

  context.res = response({
    context,
    status: 200,
    body: {
      clientPrincipal: {
        ...user,
      },
    },
  });
};

export default httpTrigger;

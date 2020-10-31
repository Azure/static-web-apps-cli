import { AzureFunction, HttpRequest } from "@azure/functions";
import { response, validateCookie } from "../../utils";
import { currentUser } from "../../userManager";

const httpTrigger: AzureFunction = function (context, req: HttpRequest) {
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

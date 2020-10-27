const { response, validateCookie, getProviderFromCookie } = require("../../utils");
const { currentUser } = require("../../userManager");

module.exports = async function (context, req) {
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

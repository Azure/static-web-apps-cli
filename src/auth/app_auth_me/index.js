const { response, validateCookie } = require("../../utils");
const { currentUser } = require("../../userManager");

module.exports = async function (context, req) {
  const cookie = req.headers.cookie;

  if (!cookie || !validateCookie(cookie)) {
    context.res = response({
      context,
      status: 200,
      body: {
        clientPrincipal: null
      }
    });
    return;
  }

  const user = currentUser();

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

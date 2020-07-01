const { response, validateCookie } = require("../src/utils");
const user = require("../src/users.json")[0];

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

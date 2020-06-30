const { response, validateCookie } = require("../utils");
const user = require("../users.json")[0];

module.exports = async function (context, req) {
  const cookie = req.headers.cookie;

  if (!cookie || !validateCookie(cookie)) {
    return response({
      context,
      status: 200,
      body: {
        clientPrincipal: null
      }
    });
  }

  return response({
    context,
    status: 200,
    body: {
      clientPrincipal: {
        ...user,
      },
    },
  });
};

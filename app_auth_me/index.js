const { response } = require("../utils");
const user = require("../users.json")[0];
const jwt = require("jsonwebtoken");
const jwtKey = "123";

module.exports = async function (context, req) {
  const token = null; //req.headers.Cookie.token;

  if (!token) {
    context.res = response({
      context,
      status: 401,
    });
    return;
  }

  var payload;
  try {
    payload = jwt.verify(token, jwtKey);
  } catch (e) {
    if (e instanceof jwt.JsonWebTokenError) {
      context.res = response({
        context,
        status: 401,
      });
    }
    context.res = response({
      context,
      status: 400,
    });
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

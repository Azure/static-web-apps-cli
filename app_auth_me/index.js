const { response } = require("../utils");
const user = require("../users.json")[0];
const jwt = require("jsonwebtoken");
const jwtKey = "123";

module.exports = async function (context, req) {
  const token = null; //req.headers.Cookie.token;

  if (!token) {
    return response({
      context,
      status: 200,
      body: {
        clientPrincipal: null
      }
    });
  }

  let payload = null;
  try {
    payload = jwt.verify(token, jwtKey);
  } catch (e) {
    if (e instanceof jwt.JsonWebTokenError) {
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
      status: 400,
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

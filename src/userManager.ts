const users = require("./users.json");
const { getProviderFromCookie } = require("./utils");

module.exports.currentUser = (cookie) => {
  const provider = getProviderFromCookie(cookie);
  return users[provider] || null;
};

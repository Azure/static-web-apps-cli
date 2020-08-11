const users = require("./users.json");

module.exports.currentUser = () => {
  return users[0];
};

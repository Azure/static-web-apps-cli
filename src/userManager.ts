import { getProviderFromCookie, SwaProviders } from "./utils";

type MockUser = {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
};

type MockUsers = {
  [key in SwaProviders]: MockUser;
};
const users: MockUsers = require("./users.json");

export const currentUser = (cookie?: string) => {
  const provider = getProviderFromCookie(cookie);
  return users[provider] || null;
};

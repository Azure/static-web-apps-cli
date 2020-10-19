import { users } from "./users";
import { getProviderFromCookie } from "./utils";

export const currentUser = (cookie) => {
  const provider = getProviderFromCookie(cookie);
  return users[provider] || null;
};

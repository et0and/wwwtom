import type { Access } from "payload";

export const authenticated: Access = ({ req: { user } }) => {
  if (!user) return false;
  return user._verified === true;
};

export const authenticatedAny: Access = ({ req: { user } }) => {
  return Boolean(user);
};

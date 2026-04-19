import type { Access } from "payload";

export const readProducts: Access = ({ req: { user } }) => {
  if (user) return true;
  return {
    and: [{ _status: { equals: "published" } }, { isAvailable: { equals: true } }],
  };
};

export const createProducts: Access = ({ req: { user } }) => Boolean(user);

export const updateProducts: Access = ({ req: { user } }) => Boolean(user);

export const deleteProducts: Access = ({ req: { user } }) => Boolean(user);

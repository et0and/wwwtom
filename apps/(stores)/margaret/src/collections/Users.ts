import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  admin: {
    useAsTitle: "name",
  },
  access: {
    admin: ({ req }) => {
      if (!req.user) return false;
      return req.user._verified === true;
    },
  },
  auth: {
    verify: true,
  },
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        if (!data || typeof data !== "object") return data;

        if (operation === "create") {
          return {
            ...data,
            _verified: false,
            _verificationToken: undefined,
          };
        }

        if (operation !== "update") return data;
        if (!req.user) return data;
        if (!("_verified" in data) && !("_verificationToken" in data)) return data;

        return {
          ...data,
          _verified: undefined,
          _verificationToken: undefined,
        };
      },
    ],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: false,
    },
    // Email added by default
    // Add more fields as needed
  ],
};

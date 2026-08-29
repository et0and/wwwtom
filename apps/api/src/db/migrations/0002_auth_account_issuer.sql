-- Better Auth 1.7 account model adds the issuer namespace for OAuth
-- accounts (e.g. the IdP issuer). 0001 shipped without it; the live
-- production D1 already recorded 0001, so ALTER here.
ALTER TABLE "account" ADD COLUMN "issuer" TEXT;

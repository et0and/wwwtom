export type Address = {
  addressId: number;
  fullAddress: string;
  fullAddressNumber: string;
  fullAddressRoad: string | null;
  suburb: string;
  townCity: string;
  territorialAuthority: string;
  region: string | null;
  postcode: string | null;
  longitude: number;
  latitude: number;
};

export type AddressFilters = {
  limit?: number;
  offset?: number;
  townCity?: string;
  suburbLocality?: string;
  roadName?: string;
  bbox?: readonly [number, number, number, number];
};

export type Bbox = readonly [number, number, number, number];

export type Meta = {
  version: string;
  totalAddresses: number;
  lastUpdated: string;
};

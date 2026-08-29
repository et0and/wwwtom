// New Zealand regional council names (dashboard choices) mapped to the
// territorial-authority keywords present in the LINZ `addresses` table.
// Matching is case-insensitive substring on territorialAuthority.

export const NZ_REGIONS = [
  "Northland",
  "Auckland",
  "Waikato",
  "Bay of Plenty",
  "Gisborne",
  "Hawke's Bay",
  "Taranaki",
  "Manawatū-Whanganui",
  "Wellington",
  "Tasman",
  "Nelson",
  "Marlborough",
  "West Coast",
  "Canterbury",
  "Otago",
  "Southland",
] as const;

const REGION_TERRITORIAL_AUTHORITY_KEYWORDS = {
  Northland: ["Far North", "Whangarei", "Kaipara"],
  Auckland: ["Auckland"],
  Waikato: [
    "Thames-Coromandel",
    "Hauraki",
    "Waikato",
    "Matamata-Piako",
    "Hamilton",
    "Waipa",
    "Otorohanga",
    "South Waikato",
    "Waitomo",
    "Taupo",
  ],
  "Bay of Plenty": [
    "Western Bay of Plenty",
    "Tauranga",
    "Rotorua",
    "Whakatane",
    "Kawerau",
    "Opotiki",
  ],
  Gisborne: ["Gisborne"],
  "Hawke's Bay": ["Wairoa", "Hastings", "Napier", "Central Hawke's Bay"],
  Taranaki: ["New Plymouth", "Stratford", "South Taranaki"],
  "Manawatū-Whanganui": [
    "Rangitikei",
    "Whanganui",
    "Manawatu",
    "Palmerston North",
    "Tararua",
    "Horowhenua",
  ],
  Wellington: [
    "Kapiti Coast",
    "Porirua",
    "Upper Hutt",
    "Lower Hutt",
    "Wellington",
    "Masterton",
    "Carterton",
    "South Wairarapa",
  ],
  Tasman: ["Tasman"],
  Nelson: ["Nelson"],
  Marlborough: ["Marlborough"],
  "West Coast": ["Buller", "Grey", "Westland"],
  Canterbury: [
    "Kaikoura",
    "Hurunui",
    "Waimakariri",
    "Christchurch",
    "Selwyn",
    "Ashburton",
    "Timaru",
    "Mackenzie",
    "Waimate",
  ],
  Otago: ["Waitaki", "Central Otago", "Queenstown-Lakes", "Dunedin", "Clutha"],
  Southland: ["Southland", "Gore", "Invercargill"],
};

export const isRegionAllowed = (
  territorialAuthority: string,
  regions: readonly string[],
): boolean =>
  regions.some((region) =>
    (REGION_TERRITORIAL_AUTHORITY_KEYWORDS[region] ?? []).some((keyword) =>
      territorialAuthority.toLowerCase().includes(keyword.toLowerCase()),
    ),
  );

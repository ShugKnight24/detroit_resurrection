// Plain-language notes on Detroit Land Bank Authority sales programs. These
// are given to the model as ground truth and shown in the UI. Rules and prices
// change, so every screen points people to buildingdetroit.org to confirm.
export const DLBA_URL = "https://buildingdetroit.org";

export const PROGRAM_NOTES: Record<string, string> = {
  "Side Lot For Sale":
    "Side Lot program: a vacant lot sold to the owner-occupant of the house directly next door, for a small fee, in exchange for maintaining it.",
  "IHOA Side Lot For Sale":
    "Side lot sold through a homeowners association arrangement. Contact the Land Bank to confirm eligibility.",
  "Neighborhood Lot For Sale":
    "Neighborhood Lot program: vacant lots sold to people who live or own property in the same neighborhood, for uses like yards, gardens, or green space.",
  "Oversized Lot For Sale":
    "Oversized lot: a larger vacant parcel sold for bigger projects such as gardens, parks, or development.",
  "Accessory Structure Lot For Sale":
    "Accessory structure lot: vacant land that can hold a garage, shed, or other accessory structure.",
  "Improved Lot For Sale":
    "Improved lot: vacant land that already has some improvement, like landscaping or fencing.",
  "Marketed Lot For Sale": "Lot actively marketed for sale by the Land Bank. Check the listing for terms.",
  "Auction Lot For Sale": "Lot offered through a Land Bank auction.",
  "Own It Now Lot For Sale": "Lot offered for direct purchase through the Own It Now program.",
  "Renovation Programs Lot For Sale": "Lot tied to a Land Bank renovation program.",
  "Create-a-Project For Sale":
    "Create-a-Project: groups and residents propose a community project, such as a garden or pocket park, on Land Bank land.",
  "Marketed Structure For Sale": "House actively marketed for sale. Buyers usually must renovate it within a set time.",
  "Auction Structure For Sale": "House offered through a Land Bank auction. Buyers must renovate and occupy it.",
  "Own It Now Structure For Sale": "House offered for direct purchase through the Own It Now program.",
  "Renovation Programs Structure For Sale": "House tied to a Land Bank renovation program.",
  "DLBA Owned Lot":
    "Land Bank owned lot that is not listed for sale yet. Residents can still ask the Land Bank about it.",
  "DLBA Owned Structure":
    "Land Bank owned house that is not listed for sale yet. It may be waiting for demolition review or a future sale.",
};

// Real Detroit organizations the model may recommend. It must not invent others.
export const PARTNERS = [
  { name: "Detroit Land Bank Authority", focus: "Owns the parcel; runs every sales program", url: DLBA_URL },
  { name: "Keep Growing Detroit", focus: "Seeds, transplants, and training for urban gardens", url: "https://www.detroitagriculture.net" },
  { name: "The Greening of Detroit", focus: "Tree planting, green space, and landscape jobs", url: "https://www.greeningofdetroit.com" },
  { name: "Detroit Future City", focus: "Land-use planning and vacant land strategies", url: "https://detroitfuturecity.com" },
  { name: "Michigan Community Resources", focus: "Free legal help for community groups and land projects", url: "https://mi-community.org" },
];

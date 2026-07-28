import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from "twenty-sdk/define";

// NAICS 2017 sector, the 2-digit level. AM-facing and deliberately short: 20 options covering
// the 24 two-digit codes (31-33, 44-45 and 48-49 are ranges in NAICS).
//
// Inferred, highest-confidence source first: the leading pair of credit's
// Credit_Industry_Code__c when it is a real sector, else the Salesforce Industry label via
// value-maps.json naicsSector. Credit's 4-digit detail is deliberately not mirrored here --
// a third of those values are SIC codes or junk (7373, 1234) -- so it stays in credit's
// systems and surfaces through the Flow company profile.
//
// Labels drop commas and are abbreviated where needed: Twenty rejects commas in option labels
// and caps them at 63 characters. The codes are canonical.
export default defineField({
  universalIdentifier: "b7e41a09-2d6c-4f18-9a53-06c8f7d21e44",
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: "naicsSector",
  label: "NAICS Sector",
  description: "NAICS 2017 2-digit sector. Inferred from the credit industry code, else the imported industry label.",
  icon: "IconBuildingFactory2",
  isNullable: true,
  defaultValue: null,
  options: [
    { id: "dae6632c-c1a7-4531-80c3-7738d726f1ed", value: "NAICS_11", label: "11 Agriculture Forestry Fishing & Hunting", position: 0, color: "green" },
    { id: "d6059325-9814-4815-810e-dd755bec0abf", value: "NAICS_21", label: "21 Mining Quarrying & Oil & Gas Extraction", position: 1, color: "orange" },
    { id: "7e334def-3bc7-44de-8f46-3c7eb8343f3b", value: "NAICS_22", label: "22 Utilities", position: 2, color: "yellow" },
    { id: "81285412-b785-4e02-8682-68da28c5406c", value: "NAICS_23", label: "23 Construction", position: 3, color: "blue" },
    { id: "9a2ed0e2-8f40-46f4-830e-512333e40eb3", value: "NAICS_31_33", label: "31-33 Manufacturing", position: 4, color: "purple" },
    { id: "d5f12ea4-13e8-4f5f-88f7-353a724694cf", value: "NAICS_42", label: "42 Wholesale Trade", position: 5, color: "turquoise" },
    { id: "6a637c26-4cef-4ff8-82c3-e3a2fd44cf38", value: "NAICS_44_45", label: "44-45 Retail Trade", position: 6, color: "pink" },
    { id: "6de3bdeb-81aa-42c5-8566-b5c352e41042", value: "NAICS_48_49", label: "48-49 Transportation & Warehousing", position: 7, color: "red" },
    { id: "6ec4daf8-2fa2-4813-8626-dca4710d94f3", value: "NAICS_51", label: "51 Information", position: 8, color: "sky" },
    { id: "9f70041c-dc1c-43d8-8425-839010cde8a3", value: "NAICS_52", label: "52 Finance & Insurance", position: 9, color: "green" },
    { id: "2f3f59b8-b593-42a5-85aa-89958cabd1ba", value: "NAICS_53", label: "53 Real Estate & Rental & Leasing", position: 10, color: "orange" },
    { id: "c66313df-efb1-4aa3-88c9-e5b123ff133e", value: "NAICS_54", label: "54 Professional Scientific & Technical Services", position: 11, color: "blue" },
    { id: "16b49928-4966-4f2a-8573-03930fce73fe", value: "NAICS_55", label: "55 Management of Companies & Enterprises", position: 12, color: "gray" },
    { id: "87b3a05c-1bd0-4d63-833b-ac8225b8f776", value: "NAICS_56", label: "56 Administrative Support & Waste Management", position: 13, color: "purple" },
    { id: "ffae8f73-b3b1-4d53-87c7-467b4c44f694", value: "NAICS_61", label: "61 Educational Services", position: 14, color: "turquoise" },
    { id: "6a1d7946-6a4b-42e7-8699-7ce8f995fdc4", value: "NAICS_62", label: "62 Health Care & Social Assistance", position: 15, color: "pink" },
    { id: "ba355bf6-863b-433b-8503-adc0d7c3c415", value: "NAICS_71", label: "71 Arts Entertainment & Recreation", position: 16, color: "red" },
    { id: "eb831ea8-fa65-4f90-8880-1fd2d0e3a611", value: "NAICS_72", label: "72 Accommodation & Food Services", position: 17, color: "yellow" },
    { id: "4ad62c3f-4775-45dc-806e-811400755dfc", value: "NAICS_81", label: "81 Other Services (except Public Administration)", position: 18, color: "sky" },
    { id: "920d7ffd-bd31-42ee-82c9-532215b8a91f", value: "NAICS_92", label: "92 Public Administration", position: 19, color: "gray" },
  ],
});

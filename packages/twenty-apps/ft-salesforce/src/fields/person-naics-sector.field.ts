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
  universalIdentifier: "f39c8d52-4b71-4e06-8d1a-27b5904ce613",
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: "naicsSector",
  label: "NAICS Sector",
  description: "NAICS 2017 2-digit sector. Inferred from the credit industry code, else the imported industry label.",
  icon: "IconBuildingFactory2",
  isNullable: true,
  defaultValue: null,
  options: [
    { id: "7993faa3-65cc-4292-8ae4-814d1befbc13", value: "NAICS_11", label: "11 Agriculture Forestry Fishing & Hunting", position: 0, color: "green" },
    { id: "471a73cf-8094-4082-8c61-0311bc98c090", value: "NAICS_21", label: "21 Mining Quarrying & Oil & Gas Extraction", position: 1, color: "orange" },
    { id: "aa174597-33b8-42cc-865d-ee2e93c53be9", value: "NAICS_22", label: "22 Utilities", position: 2, color: "yellow" },
    { id: "29a5c005-f1c8-4649-88a4-e018176b7296", value: "NAICS_23", label: "23 Construction", position: 3, color: "blue" },
    { id: "2ee00790-70c3-474d-8e1a-d94acce4dfba", value: "NAICS_31_33", label: "31-33 Manufacturing", position: 4, color: "purple" },
    { id: "e5315643-974e-45de-8dc9-935241a2df9e", value: "NAICS_42", label: "42 Wholesale Trade", position: 5, color: "turquoise" },
    { id: "cdeaf2c3-55d8-4fc7-8909-95d399abc143", value: "NAICS_44_45", label: "44-45 Retail Trade", position: 6, color: "pink" },
    { id: "2cb20507-f09d-4f44-85e6-ca71fe03ed77", value: "NAICS_48_49", label: "48-49 Transportation & Warehousing", position: 7, color: "red" },
    { id: "dbc8aef6-f507-4533-8a5d-0e808a8e2396", value: "NAICS_51", label: "51 Information", position: 8, color: "sky" },
    { id: "3260a516-458c-454f-8bca-2994154f4329", value: "NAICS_52", label: "52 Finance & Insurance", position: 9, color: "green" },
    { id: "766835bf-86a9-4fa1-8051-ee5b0b36ddc8", value: "NAICS_53", label: "53 Real Estate & Rental & Leasing", position: 10, color: "orange" },
    { id: "93fd6eee-2238-444a-8a9d-7064f2a3de1b", value: "NAICS_54", label: "54 Professional Scientific & Technical Services", position: 11, color: "blue" },
    { id: "d9c0be21-62ad-45c8-8cbb-139e40efd71f", value: "NAICS_55", label: "55 Management of Companies & Enterprises", position: 12, color: "gray" },
    { id: "7423a12f-6317-4a1e-8f71-8a7d52430c9f", value: "NAICS_56", label: "56 Administrative Support & Waste Management", position: 13, color: "purple" },
    { id: "47c0d9a1-8bf3-4f4b-8598-7e8b567f0641", value: "NAICS_61", label: "61 Educational Services", position: 14, color: "turquoise" },
    { id: "3ba43a4a-4b9a-48d4-88d5-d4677ba5de00", value: "NAICS_62", label: "62 Health Care & Social Assistance", position: 15, color: "pink" },
    { id: "4041a99b-ccc4-4b61-8dbe-1bdbb915ade8", value: "NAICS_71", label: "71 Arts Entertainment & Recreation", position: 16, color: "red" },
    { id: "c8614f0a-a433-4770-86bd-022c313890a7", value: "NAICS_72", label: "72 Accommodation & Food Services", position: 17, color: "yellow" },
    { id: "8ae59df8-bd16-4f21-8f09-a28f431fffc8", value: "NAICS_81", label: "81 Other Services (except Public Administration)", position: 18, color: "sky" },
    { id: "ed6073a0-c22f-4223-8e9d-eb40dfcd7bcf", value: "NAICS_92", label: "92 Public Administration", position: 19, color: "gray" },
  ],
});

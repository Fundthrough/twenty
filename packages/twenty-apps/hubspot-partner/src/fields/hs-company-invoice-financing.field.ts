import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { HS_COMPANY_INVOICE_FINANCING_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_INVOICE_FINANCING_UID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'hasInvoiceFinancingSolution',
  label: 'Invoice Financing Solution',
  description: 'Whether the partner has an invoice financing solution (maps HubSpot has_invoice_financing_solution)',
  icon: 'IconFileInvoice',
  isNullable: true,
  defaultValue: null,
  options: [
    {
      id: '1e175aea-9e6c-4abd-a401-06999764a983',
      value: 'YES',
      label: 'Yes',
      position: 0,
      color: 'green',
    },
    {
      id: '40f51b8d-0e97-44bb-a893-f6cce6e82c12',
      value: 'NO',
      label: 'No',
      position: 1,
      color: 'red',
    },
    {
      id: 'a69c2101-8f7a-4574-92e9-c629a7c69330',
      value: 'UNKNOWN',
      label: 'Unknown',
      position: 2,
      color: 'gray',
    },
  ],
});

import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { HS_COMPANY_EMPLOYEE_COUNT_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_EMPLOYEE_COUNT_UID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.NUMBER,
  name: 'hsNumberOfEmployees',
  label: 'Employees',
  description: 'Number of employees from HubSpot',
  icon: 'IconUsers',
  isNullable: true,
  defaultValue: null,
});

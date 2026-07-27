import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'c441855f-e00b-4405-87f7-e423489ea6ef',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'persona',
  label: "Persona",
  description: "Imported: Account.Persona__c",
  icon: 'IconList',
  options: [
    { id: 'e0907b1f-5ac0-4d67-90dc-f2e94415cbd7', value: 'SURVIVOR', label: "Survivor", position: 0, color: 'blue' },
    { id: '35c7a98c-1286-4f09-b60c-908afb7404fd', value: 'HUSTLER', label: "Hustler", position: 1, color: 'green' },
    { id: '26961f0d-c4a2-4422-a15c-bf0aa702eb54', value: 'ACCELERATOR', label: "Accelerator", position: 2, color: 'turquoise' },
    { id: '41ee9aa9-5704-463c-826f-069716fe8048', value: 'HANDSHAKER', label: "Handshaker", position: 3, color: 'yellow' },
    { id: 'd0e2e05e-77d5-4368-9428-f3587f841c8e', value: 'TECHIE', label: "Techie", position: 4, color: 'orange' },
  ],
  isNullable: true,
  defaultValue: null,
});

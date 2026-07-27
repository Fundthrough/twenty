import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { TERM_SHEET_OBJECT_UID } from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: 'e0dd298b-f1cc-4f37-b482-9673700ef94b',
  position: 4,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: TERM_SHEET_OBJECT_UID,
});

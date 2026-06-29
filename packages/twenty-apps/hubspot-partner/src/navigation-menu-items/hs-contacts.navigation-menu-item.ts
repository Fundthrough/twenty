import { defineNavigationMenuItem } from 'twenty-sdk/define';
import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { NavigationMenuItemType } from 'twenty-sdk/define';
import { HS_CONTACTS_NAV_UID } from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: HS_CONTACTS_NAV_UID,
  position: 11,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
});

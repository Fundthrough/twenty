import { defineNavigationMenuItem } from 'twenty-sdk/define';
import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { NavigationMenuItemType } from 'twenty-sdk/define';
import { HS_COMPANIES_NAV_UID } from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: HS_COMPANIES_NAV_UID,
  position: 10,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
});

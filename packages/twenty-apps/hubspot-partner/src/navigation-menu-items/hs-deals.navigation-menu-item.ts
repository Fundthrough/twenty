import { defineNavigationMenuItem } from 'twenty-sdk/define';
import { NavigationMenuItemType } from 'twenty-sdk/define';
import {
  HS_DEALS_NAV_UID,
  HS_PARTNER_DEAL_OBJECT_UID,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: HS_DEALS_NAV_UID,
  position: 12,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: HS_PARTNER_DEAL_OBJECT_UID,
});

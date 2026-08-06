import { Navbar } from "@/components/layout/navbar";
import { loadAllPromotionDiscounts } from "@/lib/storefront/promotion-discounts";

/**
 * Loads the live promotion for the search panel inside the navbar.
 *
 * The search panel is a client component that fetches the whole active catalog
 * in the browser when it first opens, so it has no product ids to batch and no
 * way to reach the service-role loader itself. This is the server boundary that
 * reads the promotion for it and hands it down as a plain, serializable prop.
 *
 * It sits in its own component rather than in AppShell so the shell stays
 * synchronous: an await there would put the whole storefront shell, including
 * every page's own content, behind this read.
 *
 * The loader already fails closed, returning nothing when the promotion cannot
 * be read or is not live, so there is no failure here that needs catching — an
 * unreadable promotion simply leaves every search result on its single price.
 */
export async function NavbarSlot() {
  const promotionDiscounts = await loadAllPromotionDiscounts();

  return <Navbar promotionDiscounts={promotionDiscounts} />;
}

-- Rebrand the storefront categories to the planned customer-facing set:
--   Perfume        -> Fragrance      (slug perfume        -> fragrance)
--   Home Fragrance -> Skincare       (slug home-fragrance -> skincare)
--   Bath & Body    -> Bath and Body  (slug bath-and-body  unchanged)
--   + Makeup       (new, empty, ready for future products)
--
-- The renames are UPDATEs that keep each category's id, so every product's
-- category_id foreign key is preserved — the existing perfume products stay
-- linked and simply appear under Fragrance. Nothing is deleted, so no product
-- or relationship is lost. The final insert-on-conflict guarantees all four
-- categories exist afterward even if a source category was absent.

-- 1. Perfume -> Fragrance. Existing products keep their category_id.
update public.categories
set
  name = 'Fragrance',
  slug = 'fragrance',
  description =
    'Fragrance from luxury and independent brands, selected for depth, balance, and daily wear.'
where slug = 'perfume';

-- 2. Home Fragrance -> Skincare.
update public.categories
set
  name = 'Skincare',
  slug = 'skincare',
  description = 'Skincare selected for gentle, effective everyday care.'
where slug = 'home-fragrance';

-- 3. Bath & Body -> Bath and Body. The slug already matches the new scheme, so
-- only the display name changes.
update public.categories
set
  name = 'Bath and Body',
  description =
    'Bath and body essentials selected for refined scent, texture, and everyday use.'
where slug = 'bath-and-body';

-- 4. Ensure the full planned set exists. Any category the renames above did not
-- produce (because its source was missing) is created here; Makeup is always
-- new. on conflict (slug) leaves already-present categories untouched, so this
-- never duplicates a row or changes an existing category's id.
insert into public.categories (name, slug, description)
values
  (
    'Fragrance',
    'fragrance',
    'Fragrance from luxury and independent brands, selected for depth, balance, and daily wear.'
  ),
  (
    'Skincare',
    'skincare',
    'Skincare selected for gentle, effective everyday care.'
  ),
  (
    'Makeup',
    'makeup',
    'Makeup and colour cosmetics, coming to the Sombre edit.'
  ),
  (
    'Bath and Body',
    'bath-and-body',
    'Bath and body essentials selected for refined scent, texture, and everyday use.'
  )
on conflict (slug) do nothing;

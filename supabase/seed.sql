-- Development seed data for Sombre.
-- This file is intended for local MVP storefront development and testing only.

begin;

-- Refuse to run unless the catalog is completely empty. This script contains
-- no delete/truncate statements, so it can never remove or overwrite existing
-- rows such as the real Maison Margiela catalog (see supabase/manual/*.sql).
do $$
begin
  if exists (select 1 from public.brands)
    or exists (select 1 from public.categories)
    or exists (select 1 from public.products)
    or exists (select 1 from public.product_images)
  then
    raise exception
      'Refusing to run supabase/seed.sql: the catalog already contains data. This development-only seed works on an empty catalog and will not modify existing rows.';
  end if;
end
$$;

-- Brands
insert into public.brands (name, slug, description)
values
  (
    'Noct Atelier',
    'noct-atelier',
    'A restrained fragrance house focused on smoky woods, soft resins, and evening rituals.'
  ),
  (
    'Vale & Hearth',
    'vale-and-hearth',
    'A modern lifestyle label blending clean body care with warm mineral and botanical notes.'
  ),
  (
    'Lune Forme',
    'lune-forme',
    'A quiet luxury studio creating sculptural home scent and bath essentials.'
  );

-- Categories
insert into public.categories (name, slug, description)
values
  (
    'Perfume',
    'perfume',
    'Signature scents designed for daily wear and evening depth.'
  ),
  (
    'Bath & Body',
    'bath-and-body',
    'Refined cleansing and body care essentials with elevated texture and scent.'
  ),
  (
    'Home Fragrance',
    'home-fragrance',
    'Atmospheric objects for scenting quiet interiors.'
  );

-- Products
insert into public.products (
  brand_id,
  category_id,
  name,
  slug,
  description,
  short_description,
  size_label,
  price,
  stock_quantity,
  is_featured,
  is_active
)
select
  brand.id,
  category.id,
  product_data.name,
  product_data.slug,
  product_data.description,
  product_data.short_description,
  product_data.size_label,
  product_data.price,
  product_data.stock_quantity,
  product_data.is_featured,
  true
from (
  values
    (
      'noct-atelier',
      'perfume',
      'Velvet Ember',
      'velvet-ember',
      'A concentrated perfume layered with black tea, cedar smoke, and softened amber for a quietly dramatic finish.',
      'Smoky amber extrait.',
      '50 mL',
      148.00::numeric,
      18,
      true
    ),
    (
      'noct-atelier',
      'perfume',
      'Dusk Veil',
      'dusk-veil',
      'A refined perfume with iris, pale suede, and mineral musk that settles close to the skin.',
      'Iris and suede eau de parfum.',
      '50 mL',
      132.00::numeric,
      12,
      false
    ),
    (
      'vale-and-hearth',
      'bath-and-body',
      'Silken Resin Body Lotion',
      'silken-resin-body-lotion',
      'A rich but fast-absorbing body lotion scented with blond woods, soft incense, and dry citrus peel.',
      'Nourishing daily body lotion.',
      '250 mL',
      58.00::numeric,
      26,
      true
    ),
    (
      'vale-and-hearth',
      'bath-and-body',
      'Stone Moss Hand Wash',
      'stone-moss-hand-wash',
      'A gentle hand wash with green moss, eucalyptus leaf, and a clean mineral finish.',
      'Crisp botanical hand wash.',
      '350 mL',
      34.00::numeric,
      31,
      false
    ),
    (
      'lune-forme',
      'home-fragrance',
      'Quiet Flame Candle',
      'quiet-flame-candle',
      'A slow-burning candle with labdanum, charred fig wood, and subtle clove for intimate interiors.',
      'Warm resin candle.',
      '280 g',
      76.00::numeric,
      20,
      true
    ),
    (
      'lune-forme',
      'bath-and-body',
      'Pale Marble Body Cleanser',
      'pale-marble-body-cleanser',
      'A low-foam body cleanser with neroli leaf, rice milk, and white cedar for a calm, polished scent trail.',
      'Creamy body cleanser.',
      '300 mL',
      42.00::numeric,
      24,
      false
    )
) as product_data(
  brand_slug,
  category_slug,
  name,
  slug,
  description,
  short_description,
  size_label,
  price,
  stock_quantity,
  is_featured
)
join public.brands as brand
  on brand.slug = product_data.brand_slug
join public.categories as category
  on category.slug = product_data.category_slug;

-- Product images
insert into public.product_images (
  product_id,
  image_url,
  alt_text,
  sort_order,
  is_primary
)
select
  product.id,
  image_data.image_url,
  image_data.alt_text,
  image_data.sort_order,
  image_data.is_primary
from (
  values
    (
      'velvet-ember',
      '/images/products/velvet-ember-01.jpg',
      'Velvet Ember bottle on dark stone',
      0,
      true
    ),
    (
      'velvet-ember',
      '/images/products/velvet-ember-02.jpg',
      'Velvet Ember detail with cap and carton',
      1,
      false
    ),
    (
      'dusk-veil',
      '/images/products/dusk-veil-01.jpg',
      'Dusk Veil bottle in soft shadow',
      0,
      true
    ),
    (
      'dusk-veil',
      '/images/products/dusk-veil-02.jpg',
      'Dusk Veil fragrance with folded paper backdrop',
      1,
      false
    ),
    (
      'silken-resin-body-lotion',
      '/images/products/silken-resin-body-lotion-01.jpg',
      'Silken Resin Body Lotion bottle on travertine',
      0,
      true
    ),
    (
      'silken-resin-body-lotion',
      '/images/products/silken-resin-body-lotion-02.jpg',
      'Silken Resin Body Lotion texture close-up',
      1,
      false
    ),
    (
      'stone-moss-hand-wash',
      '/images/products/stone-moss-hand-wash-01.jpg',
      'Stone Moss Hand Wash beside matte basin',
      0,
      true
    ),
    (
      'stone-moss-hand-wash',
      '/images/products/stone-moss-hand-wash-02.jpg',
      'Stone Moss Hand Wash pump detail',
      1,
      false
    ),
    (
      'quiet-flame-candle',
      '/images/products/quiet-flame-candle-01.jpg',
      'Quiet Flame Candle lit on dark oak',
      0,
      true
    ),
    (
      'quiet-flame-candle',
      '/images/products/quiet-flame-candle-02.jpg',
      'Quiet Flame Candle vessel and packaging',
      1,
      false
    ),
    (
      'pale-marble-body-cleanser',
      '/images/products/pale-marble-body-cleanser-01.jpg',
      'Pale Marble Body Cleanser bottle in warm light',
      0,
      true
    ),
    (
      'pale-marble-body-cleanser',
      '/images/products/pale-marble-body-cleanser-02.jpg',
      'Pale Marble Body Cleanser texture and bottle detail',
      1,
      false
    )
) as image_data(
  product_slug,
  image_url,
  alt_text,
  sort_order,
  is_primary
)
join public.products as product
  on product.slug = image_data.product_slug;

commit;

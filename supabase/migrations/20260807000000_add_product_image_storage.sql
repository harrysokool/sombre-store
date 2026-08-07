-- Storage foundation for uploaded product images.
--
-- This migration only prepares the ground. No file is uploaded, no existing row
-- is changed, and nothing a customer or an administrator can see behaves
-- differently once it is applied. Product images today are local paths under
-- public/images/products, and they keep working exactly as they are.

-- ---------------------------------------------------------------------------
-- 1. Where an uploaded image lives inside the bucket.
-- ---------------------------------------------------------------------------

alter table if exists public.product_images
  add column if not exists storage_object_path text;

comment on column public.product_images.storage_object_path is
  'Object path inside the product-images Storage bucket for an uploaded image, or null for an image served from a local path under public/. Held alongside image_url so removing an image can find its stored object without parsing the path back out of a URL.';

-- Nullable, because every image that exists today is a local path and has no
-- stored object at all. Backfilling one would be inventing data, so the column
-- is added empty and only ever set by a future upload.
--
-- The guard below constrains only rows that do set a path. It mirrors the shape
-- the application generates — a product-scoped folder and a random object name —
-- and refuses the two things that would let a path escape its folder: a leading
-- slash, which would make it absolute, and a parent-directory segment.
alter table if exists public.product_images
  add constraint product_images_storage_object_path_shape_check
    check (
      storage_object_path is null
      or (
        storage_object_path = btrim(storage_object_path)
        and char_length(storage_object_path) between 1 and 500
        and storage_object_path not like '/%'
        -- chr(92) is a backslash, spelled this way because LIKE would otherwise
        -- read one as its own escape character.
        and strpos(storage_object_path, chr(92)) = 0
        and position('..' in storage_object_path) = 0
      )
    );

-- Finds the row owning a stored object during cleanup, and keeps the sweep for
-- orphaned files cheap. Partial, because most rows never set the column.
create index if not exists idx_product_images_storage_object_path
  on public.product_images (storage_object_path)
  where storage_object_path is not null;

-- ---------------------------------------------------------------------------
-- 2. The bucket that will hold uploaded product images.
-- ---------------------------------------------------------------------------

-- Public, because these are the marketing images the storefront shows to
-- anonymous shoppers. A private bucket would force signed URLs, which expire,
-- and that would defeat CDN caching and next/image optimisation for images that
-- are meant to be seen by everyone.
--
-- Reads being public is not the same as writes being open: see the note below.
--
-- The MIME allowlist and size limit are enforced by Storage itself, so they hold
-- even if an application-level check is ever bypassed or forgotten. SVG is
-- deliberately absent: it is XML, it can carry script, and next/image refuses to
-- optimise it without dangerouslyAllowSVG, which this project does not set.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  4194304, -- 4 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 3. Write access.
-- ---------------------------------------------------------------------------

-- No insert, update, or delete policy is created here, for anon or for
-- authenticated, and that omission is the access control rather than an
-- oversight. RLS on storage.objects denies by default, so with no write policy
-- in place only the service role — which bypasses RLS and is used exclusively by
-- trusted server code — can put an object in this bucket or remove one.
--
-- This mirrors how the catalog tables are already protected: public may read,
-- nobody may write except the server. Adding a write policy for authenticated
-- users would be wrong here, because an administrator is identified by matching
-- ADMIN_EMAIL in application code, not by any claim the database can check.
--
-- No select policy is needed either: a public bucket is served through the
-- public object endpoint, which does not consult storage.objects policies.

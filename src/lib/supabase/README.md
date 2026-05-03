# Supabase Clients

This folder keeps the project's Supabase client setup in one place.

## Client Files

- `env.ts`  
  Validates the required public Supabase environment variables.

- `client.ts`  
  Creates the browser/client-side Supabase anon client.

- `server.ts`  
  Creates a server-side Supabase anon client. This is used for public reads, such as catalog and product data.

- `service-role.ts`  
  Creates a server-only Supabase service role client. This is used for trusted backend writes, especially Stripe webhook order persistence.

## Required Env Vars

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Usage

Browser/client-side public access:

```ts
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const supabase = createSupabaseBrowserClient();
```

Server-side public reads:

```ts
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supabase = createSupabaseServerClient();
```

Trusted backend writes:

```ts
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const supabase = createSupabaseServiceRoleClient();
```

## Safety Notes

- `SUPABASE_SERVICE_ROLE_KEY` must only be used in server files.
- Do not expose the service role key with a `NEXT_PUBLIC_` prefix.
- The service role client bypasses RLS, so keep it limited to trusted backend paths.
- The Stripe webhook uses the service role client to insert `orders` and `order_items`.
- Before public deployment, review RLS policies for private order data.

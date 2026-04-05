# Supabase foundation

This folder keeps the project's Supabase setup in one place.

- `env.ts` validates the required public environment variables.
- `client.ts` creates a browser/client-side Supabase instance.
- `server.ts` creates a server-side Supabase instance for future server components, actions, or route handlers.

Later usage examples:

```ts
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const supabase = createSupabaseBrowserClient();
```

```ts
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supabase = createSupabaseServerClient();
```

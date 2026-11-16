<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Family scoping: every family-owned table has `family_id` and RLS `family_id = public.current_family_id()`; users join families only via the `create_family`/`join_family` RPCs. Why: keeps all data isolated per family without client trust.
- Alert/date rules (overdue, service due, warranty expiring, recurrence) live in `src/lib/household.ts` with tests. Why: dashboard, review, calendar and bell must agree.
- Calendar events come from `CalendarSource`s in `src/lib/calendar-sources.ts`; external feeds plug in as a new source. Why: OAuth calendars are planned later.
- Item photos are stored in the private `item-photos` bucket under `<family_id>/...` and shown via signed URLs. Why: storage RLS keys off the first folder.

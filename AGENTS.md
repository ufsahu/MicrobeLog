<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Datasets are pre-packed into public/data/db.json (compact tuples) and all statistics are computed in the browser (src/lib/data.ts) — avoids a database for a static synthetic dataset.
- Resistance % always uses firstIsolates() + MIN_ISOLATES (30) from src/lib/data.ts — single source of the surveillance rule.
- Files >10MB (susceptibility.csv) are served via lovable-assets pointers, not committed.
- AI chat: client builds a data-summary context; src/routes/api/chat.ts streams from the AI gateway Responses API as plain text.
- UI strings live in src/lib/i18n.tsx (EN/FI); dataset names use the CSVs' own _fi/_en columns.

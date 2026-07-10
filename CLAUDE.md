# TIMEZONE.GURU DEVELOPMENT GUIDE

## Build Commands
- `pnpm dev` or `pnpm start`: Start development server (Astro)
- `pnpm build`: Build for production (`dist/`)
- `pnpm preview` or `pnpm serve`: Serve production build locally
- `pnpm typecheck`: Run Astro + TypeScript type checking
- `pnpm deploy`: Build site and deploy via AWS CDK (`cdk/` → S3 + CloudFront)

## Stack
- **Astro** static site (no React / no UI kit)
- **Vanilla TypeScript** client modules for interactivity (`src/scripts/`)
- **@vvo/tzdb** for searchable major cities + IANA zones (not browser zone enumeration)
- **Intl** for wall-time conversion (DST-correct via the runtime IANA data)

## Code Style Guidelines
- **TypeScript**: Use strict typing with explicit return types
- **Astro first**: Prefer `.astro` markup + CSS; only add client JS where needed
- **Imports**: Group external then internal
- **Naming**: PascalCase for components, camelCase for variables/functions
- **Components**: Place Astro components under `src/components`
- **Formatting**: 2-space indentation, trailing commas, semicolons required
- **Accessibility**: Semantic table for the comparison grid; labelled controls

## Architecture notes
- Grid orientation: **hours = rows**, **locations = columns** (mobile-friendly sticky first column).
- Each row is one absolute instant (your local hour on the selected date); cells show wall time in each zone via `Intl`.
- Activity colors are an optional template keyed by each city’s local hour — demoted to a `<details>` section.

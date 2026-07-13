# Time Zone Guru

Compare the same moment across cities. **Hours are rows, locations are columns** — built to work on phones. Daylight saving and other offset changes are handled by the browser’s IANA timezone data.

## Develop

```shell
pnpm install
pnpm dev
```

Open [http://localhost:4321](http://localhost:4321).

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Local dev server |
| `pnpm site:build` / `pnpm build` | Production build → `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm typecheck` | Astro + TypeScript checks |
| `pnpm cities:extract` | Refresh searchable cities from GeoNames → `src/data/cities.json` |
| `pnpm site:deploy` | **Build site + CDK deploy** (recommended) |
| `pnpm deploy` | Alias for `site:deploy` |
| `pnpm cdk -- <args>` | Run AWS CDK CLI in the `cdk` package |
| `pnpm cdk:diff` | Show pending CloudFormation changes |

## Stack

- **Site:** Astro static site + small client TypeScript modules  
- **Cities:** GeoNames extract (committed JSON) mapped to IANA zones  
- **Hosting:** AWS CDK → S3 + CloudFront + Route 53 (`cdk/`)  
- **Domain:** [timezone.guru](https://timezone.guru)

## Deploy

Requires AWS credentials and a Route 53 hosted zone for `timezone.guru`. First time in an account/region:

```shell
pnpm install
cd cdk && pnpm exec cdk bootstrap   # us-east-1 for CloudFront certs
```

Then from the **repo root**:

```shell
pnpm site:deploy
```

That runs `astro build` then deploys the CDK stack (uploads `dist/` and applies infra).

**Important:** Syncing files to S3 alone is not enough after infra changes (e.g. CloudFront Functions). Use CDK deploy for the stack, or at least redeploy when the stack changes.

### Manual S3-only content update (after stack exists)

```shell
pnpm site:build
aws s3 sync dist/ s3://$BUCKET --delete
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

Pretty URLs (`/help/`, `/about/`) work via **S3 website hosting** index documents (public origin). CloudFront still provides HTTPS, caching, and `www` → apex.

See [cdk/README.md](./cdk/README.md).

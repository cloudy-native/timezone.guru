# Time Zone Guru

Compare the same moment across cities. **Hours are rows, locations are columns** — built to work on phones. Daylight saving and other offset changes are handled by the browser’s IANA timezone data.

## Develop

```shell
pnpm install
pnpm dev
```

Open [http://localhost:4321](http://localhost:4321).

## Scripts

| Command            | Description                                      |
| ------------------ | ------------------------------------------------ |
| `pnpm dev`         | Local dev server                                 |
| `pnpm build`       | Production build → `dist/`                       |
| `pnpm preview`     | Serve the production build                       |
| `pnpm typecheck`   | Astro + TypeScript checks                        |
| `pnpm deploy`      | Build site and deploy via AWS CDK (S3/CloudFront) |

## Stack

- **Site:** Astro static site + small client TypeScript modules  
- **Hosting:** AWS CDK → S3 + CloudFront + Route 53 (`cdk/`)  
- **Domain:** [timezone.guru](https://timezone.guru)

## Deploy

Requires AWS credentials and a Route 53 hosted zone for `timezone.guru`. First time in an account/region:

```shell
cd cdk && pnpm install && pnpm exec cdk bootstrap
```

Then from the repo root:

```shell
pnpm deploy
```

See [cdk/README.md](./cdk/README.md) for details.

# timezone.guru — AWS CDK

Hosts the Astro static build on **S3 + CloudFront**, with **Route 53** DNS and an ACM certificate for `timezone.guru` / `www.timezone.guru`.

```
dist/  →  S3 (private)  →  CloudFront (HTTPS, www→apex)  →  Route 53 A records
```

## Prerequisites

1. AWS CLI credentials with rights for S3, CloudFront, ACM, Route 53, IAM  
2. A public hosted zone for `timezone.guru` in Route 53 (same account)  
3. Node.js 20+ and pnpm  
4. CDK bootstrapped once per account/region:

```bash
cd cdk
pnpm install
pnpm exec cdk bootstrap
```

CloudFront certificates must live in **us-east-1**. Set the stack region accordingly (default in the app is `us-east-1`).

## Deploy

From the repo root (builds the site, then deploys):

```bash
pnpm deploy
```

Or from `cdk/` after a local build:

```bash
# from repo root
pnpm build

cd cdk
pnpm install
pnpm deploy
```

## Useful commands

| Command | Description |
| --- | --- |
| `pnpm synth` | CloudFormation template |
| `pnpm diff` | Pending changes |
| `pnpm deploy` | Deploy stack |
| `pnpm destroy` | Tear down stack (empties the site bucket) |

## Notes

- Deployment source is `../dist` (Astro output). Always `pnpm build` first.  
- `www` requests are 301-redirected to the apex via a CloudFront Function.  
- 403/404 from the origin map to `/404.html`.

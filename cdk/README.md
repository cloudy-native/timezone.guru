# timezone.guru — AWS CDK

Hosts the Astro static build on **S3 website hosting + CloudFront**, with **Route 53** DNS and an ACM certificate for `timezone.guru` / `www.timezone.guru`.

```
dist/  →  S3 (public website)  →  CloudFront (HTTPS, www→apex)  →  Route 53
```

The bucket is **publicly readable**. That matches the product: the same HTML is served on CloudFront. Website hosting gives directory indexes for free (`/help/` → `help/index.html`), so no path-rewrite function is required.

## Prerequisites

1. AWS CLI credentials (S3, CloudFront, ACM, Route 53, IAM)  
2. Route 53 public hosted zone for `timezone.guru`  
3. Node.js 20+ and pnpm  
4. From the **repo root**:

```bash
pnpm install
```

5. Bootstrap CDK once per account/region (**us-east-1** for CloudFront certs):

```bash
cd cdk
pnpm exec cdk bootstrap
```

## Deploy

From the **repo root**:

```bash
pnpm site:deploy
```

Or:

```bash
pnpm site:build
cd cdk
pnpm exec cdk deploy
```

Use **`pnpm exec cdk …`** so deps resolve from this package. A bare global `cdk` often fails with missing `aws-cdk-lib`.

## Useful commands

| Command | Description |
| --- | --- |
| `pnpm exec cdk ls` | List stacks |
| `pnpm exec cdk synth` | CloudFormation template |
| `pnpm exec cdk diff` | Pending changes |
| `pnpm exec cdk deploy` | Deploy stack (expects fresh `../dist`) |
| `pnpm exec cdk destroy` | Tear down stack |

## Notes

- Always `pnpm site:build` before deploy so `../dist` is current.  
- Origin is the **S3 website endpoint** (HTTP between CloudFront and S3; viewers still get HTTPS).  
- CloudFront Function only redirects `www` → apex.  
- Content is public at the bucket website URL as well as on the custom domain.

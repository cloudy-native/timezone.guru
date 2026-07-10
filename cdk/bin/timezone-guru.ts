#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { TimezoneGuruStack } from "../lib/timezone-guru-stack";

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? "us-east-1";

if (!account) {
  throw new Error(
    "CDK_DEFAULT_ACCOUNT is not set. Configure AWS credentials " +
      "(e.g. `aws configure` or export AWS_PROFILE) so the CDK CLI can resolve the account. " +
      "CloudFront certificates require region us-east-1.",
  );
}

const app = new App();
const domainName = "timezone.guru";

new TimezoneGuruStack(app, "TimezoneGuruStack", {
  domainName,
  env: { account, region },
  tags: {
    Project: domainName,
    Environment: "production",
  },
  description: "Static site for timezone.guru (S3 + CloudFront + Route 53)",
});

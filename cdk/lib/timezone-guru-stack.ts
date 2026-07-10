import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import {
  CachePolicy,
  Distribution,
  Function as CfFunction,
  FunctionCode,
  FunctionEventType,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  OriginAccessIdentity,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import * as path from "node:path";

export interface TimezoneGuruStackProps extends StackProps {
  domainName: string;
}

/**
 * Static site: private S3 origin → CloudFront (HTTPS + www→apex) → Route 53.
 * Deploys the Astro build from ../dist.
 */
export class TimezoneGuruStack extends Stack {
  constructor(scope: Construct, id: string, props: TimezoneGuruStackProps) {
    super(scope, id, props);

    const { domainName } = props;
    const wwwDomain = `www.${domainName}`;

    const websiteBucket = new Bucket(this, "WebsiteBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new BucketDeployment(this, "WebsiteDeployment", {
      sources: [Source.asset(path.join(__dirname, "..", "..", "dist"))],
      destinationBucket: websiteBucket,
      prune: true,
      memoryLimit: 512,
    });

    const hostedZone = HostedZone.fromLookup(this, "HostedZone", {
      domainName,
    });

    const certificate = new Certificate(this, "Certificate", {
      domainName,
      subjectAlternativeNames: [wwwDomain],
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const originAccessIdentity = new OriginAccessIdentity(
      this,
      "OriginAccessIdentity",
    );
    websiteBucket.grantRead(originAccessIdentity);

    // Viewer request: www → apex
    const normalizeHost = new CfFunction(this, "NormalizeHost", {
      comment: `Redirect www.${domainName} to apex`,
      code: FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var host = request.headers.host ? request.headers.host.value : '';
  var uri = request.uri || '/';
  if (host.indexOf('www.') === 0) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: 'https://' + host.slice(4) + uri },
        'cache-control': { value: 'max-age=3600' }
      }
    };
  }
  return request;
}
`),
    });

    const securityHeaders = new ResponseHeadersPolicy(this, "SecurityHeaders", {
      comment: `Security headers for ${domainName}`,
      securityHeadersBehavior: {
        strictTransportSecurity: {
          override: true,
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          preload: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: {
          override: true,
          frameOption: HeadersFrameOption.DENY,
        },
        referrerPolicy: {
          override: true,
          referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
        },
      },
    });

    const distribution = new Distribution(this, "Distribution", {
      certificate,
      domainNames: [domainName, wwwDomain],
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: new S3Origin(websiteBucket, { originAccessIdentity }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            function: normalizeHost,
            eventType: FunctionEventType.VIEWER_REQUEST,
          },
        ],
        responseHeadersPolicy: securityHeaders,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 404,
          responsePagePath: "/404.html",
          ttl: Duration.seconds(10),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: "/404.html",
          ttl: Duration.seconds(10),
        },
      ],
    });

    new ARecord(this, "ApexARecord", {
      zone: hostedZone,
      recordName: domainName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    new ARecord(this, "WwwARecord", {
      zone: hostedZone,
      recordName: wwwDomain,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    new CfnOutput(this, "DistributionDomainName", {
      value: distribution.domainName,
    });
    new CfnOutput(this, "WebsiteBucketName", {
      value: websiteBucket.bucketName,
    });
    new CfnOutput(this, "CertificateArn", {
      value: certificate.certificateArn,
    });
  }
}

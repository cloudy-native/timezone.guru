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
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3StaticWebsiteOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
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
 * Static site: public S3 website origin → CloudFront (HTTPS + www→apex) → Route 53.
 *
 * Website hosting serves directory indexes (help/index.html for /help/), so no
 * URI-rewrite function is needed. Content is already public via CloudFront.
 */
export class TimezoneGuruStack extends Stack {
  constructor(scope: Construct, id: string, props: TimezoneGuruStackProps) {
    super(scope, id, props);

    const { domainName } = props;
    const wwwDomain = `www.${domainName}`;

    const websiteBucket = new Bucket(this, "WebsiteBucket", {
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "404.html",
      publicReadAccess: true,
      // Allow a public bucket policy; do not use ACLs
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new BucketDeployment(this, "WebsiteDeployment", {
      sources: [Source.asset(path.join(__dirname, "..", "..", "dist"))],
      destinationBucket: websiteBucket,
      // Website hosting: ensure HTML is served with the right content type
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

    // Only job left for a function: keep a single canonical host
    const wwwRedirect = new CfFunction(this, "WwwRedirect", {
      comment: `Redirect www.${domainName} to apex`,
      code: FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var host = request.headers.host ? request.headers.host.value : '';
  var uri = request.uri || '/';

  if (host.indexOf('www.') !== 0) {
    return request;
  }

  var qs = [];
  if (request.querystring) {
    for (var key in request.querystring) {
      if (!Object.prototype.hasOwnProperty.call(request.querystring, key)) continue;
      var multi = request.querystring[key];
      if (multi.multiValue) {
        for (var i = 0; i < multi.multiValue.length; i++) {
          qs.push(encodeURIComponent(key) + '=' + encodeURIComponent(multi.multiValue[i].value));
        }
      } else if (multi.value !== undefined) {
        qs.push(encodeURIComponent(key) + '=' + encodeURIComponent(multi.value));
      } else {
        qs.push(encodeURIComponent(key));
      }
    }
  }

  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: {
        value: 'https://' + host.slice(4) + uri + (qs.length ? '?' + qs.join('&') : '')
      },
      'cache-control': { value: 'max-age=3600' }
    }
  };
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
      // Website origin handles / and /help/ indexes; defaultRootObject is still fine for /
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: new S3StaticWebsiteOrigin(websiteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            function: wwwRedirect,
            eventType: FunctionEventType.VIEWER_REQUEST,
          },
        ],
        responseHeadersPolicy: securityHeaders,
      },
      errorResponses: [
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
    new CfnOutput(this, "WebsiteEndpoint", {
      value: websiteBucket.bucketWebsiteUrl,
    });
    new CfnOutput(this, "CertificateArn", {
      value: certificate.certificateArn,
    });
  }
}

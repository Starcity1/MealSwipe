const cdk = require('aws-cdk-lib');
const ec2 = require('aws-cdk-lib/aws-ec2');
const ecs = require('aws-cdk-lib/aws-ecs');
const ecsPatterns = require('aws-cdk-lib/aws-ecs-patterns');
const ecr = require('aws-cdk-lib/aws-ecr');
const s3 = require('aws-cdk-lib/aws-s3');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const s3deploy = require('aws-cdk-lib/aws-s3-deployment');
const route53 = require('aws-cdk-lib/aws-route53');
const targets = require('aws-cdk-lib/aws-route53-targets');
const acm = require('aws-cdk-lib/aws-certificatemanager');

class MealSwipeAppService extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create a new VPC with default settings (2 AZs for high availability)
    const vpc = new ec2.Vpc(this, 'MealSwipeVPC', {
      maxAzs: 2,
    });

    // Create an ECS cluster within the VPC
    const cluster = new ecs.Cluster(this, 'MealSwipeCluster', { vpc });

    // Add EC2 capacity to the cluster
    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t3.small'),
      desiredCapacity: 2,
      minCapacity: 1,
      maxCapacity: 4
    });

    // Reference existing ECR repository for backend instead of creating it
    const backendRepo = ecr.Repository.fromRepositoryName(
      this, 
      'BackendRepo', 
      'mealswipe/backend-repo'
    );

    // Backend service with load balancer
    const backendService = new ecsPatterns.ApplicationLoadBalancedEc2Service(this, 'BackendService', {
      cluster,
      memoryLimitMiB: 1024,
      cpu: 512,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(backendRepo, 'latest'),
        containerPort: 5000,
        environment: {
          NODE_ENV: 'production'
        },
        // Adding healthcheck to ensure connection to ECR container works.dd
        healthCheck: {
          command: ["CMD-SHELL", "curl -X GET -f http://localhost:5000/health || exit 1"],
          interval: cdk.Duration.seconds(30),
          retries: 3,
          timeout: cdk.Duration.minutes(3)
        },
        // Adding logging for debugging
        enableLogging: true,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'backend-service',
          logRetention: logs.RetentionDays.ONE_WEEK
        })
      },
    });

    // Grant the ECS task roles permissions to pull images
    backendRepo.grantPull(backendService.taskDefinition.taskRole);

    // Add scaling policies for the backend service
    const scalableTarget = backendService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    scalableTarget.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 80,
    });

    scalableTarget.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
    });

    // =========== FRONTEND S3 + CLOUDFRONT SETUP ===========
    
    // S3 bucket for frontend static files
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: 'mealswipe-frontend',
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA support
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedOrigins: ['*'],
          allowedMethods: [s3.HttpMethods.GET],
          allowedHeaders: ['*'],
        },
      ],
    });

    // CloudFront origin access identity to access the S3 bucket
    const cloudFrontOAI = new cloudfront.OriginAccessIdentity(this, 'CloudFrontOAI');
    
    // Grant the OAI read access to the bucket
    frontendBucket.grantRead(cloudFrontOAI);

    // Create CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: new origins.S3BucketOrigin(frontendBucket, {
          originAccessIdentity: cloudFrontOAI
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // For SPA routing
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Cheapest option
      enabled: true,
    });

    // Add a behavior for API calls to be forwarded to the backend service
    distribution.addBehavior('/api/*', new origins.LoadBalancerV2Origin(backendService.loadBalancer, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    }), {
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
    });

    // Output important resources
    new cdk.CfnOutput(this, 'BackendURL', {
      value: `http://${backendService.loadBalancer.loadBalancerDnsName}`
    });

    new cdk.CfnOutput(this, 'FrontendURL', {
      value: `https://${distribution.distributionDomainName}`
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: frontendBucket.bucketName
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId
    });
  }
}

module.exports = { MealSwipeAppService };
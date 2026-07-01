/// <reference path="../.sst/platform/config.d.ts" />

const domainPrefix = `${$app.name}-${$app.stage}`
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "-");

export const userPool = new aws.cognito.UserPool("UserPool", {
  name: `${$app.name}-${$app.stage}-user-pool`,
  usernameAttributes: ["email"],
  autoVerifiedAttributes: ["email"],
  accountRecoverySetting: {
    recoveryMechanisms: [{ name: "verified_email", priority: 1 }],
  },
  passwordPolicy: {
    minimumLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireNumbers: true,
    requireSymbols: false,
    temporaryPasswordValidityDays: 7,
  },
  emailConfiguration: {
    emailSendingAccount: "COGNITO_DEFAULT",
  },
  tags: {
    Project: $app.name,
    Environment: $app.stage,
    Owner: "spacedev",
  },
});

export const userPoolDomain = new aws.cognito.UserPoolDomain("UserPoolDomain", {
  domain: domainPrefix,
  userPoolId: userPool.id,
});

export const userPoolClient = new aws.cognito.UserPoolClient("UserPoolClient", {
  name: `${$app.name}-${$app.stage}-mobile-client`,
  userPoolId: userPool.id,
  generateSecret: false,
  allowedOauthFlows: ["code"],
  allowedOauthFlowsUserPoolClient: true,
  allowedOauthScopes: ["email", "openid", "profile"],
  callbackUrls: ["rn-wdk-exercise://"],
  logoutUrls: ["rn-wdk-exercise://"],
  supportedIdentityProviders: ["COGNITO"],
  enableTokenRevocation: true,
  explicitAuthFlows: ["ALLOW_REFRESH_TOKEN_AUTH"],
});

export const userPoolId = userPool.id;
export const userPoolClientId = userPoolClient.id;
export const cognitoDomain = $interpolate`https://${userPoolDomain.domain}.auth.us-east-1.amazoncognito.com`;

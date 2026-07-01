import { registerAs } from '@nestjs/config';

export const cognitoConfig = registerAs('cognito', () => {
  const region = process.env['COGNITO_REGION'] ?? 'us-east-1';
  const userPoolId = process.env['COGNITO_USER_POOL_ID'] ?? '';
  return {
    region,
    userPoolId,
    jwksUri: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
  };
});

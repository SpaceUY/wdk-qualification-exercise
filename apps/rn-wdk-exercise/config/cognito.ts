import type * as AuthSession from 'expo-auth-session';

// Single source of truth for the Cognito Hosted-UI config. Consumed by the
// sign-in flow (hooks/useCognito.ts) and the idToken-refresh path (utils/api.ts).
export const COGNITO_DOMAIN = process.env.EXPO_PUBLIC_COGNITO_DOMAIN ?? '';
export const COGNITO_CLIENT_ID = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? '';

export const cognitoDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${COGNITO_DOMAIN}/oauth2/authorize`,
  tokenEndpoint: `${COGNITO_DOMAIN}/oauth2/token`,
  revocationEndpoint: `${COGNITO_DOMAIN}/oauth2/revoke`,
};

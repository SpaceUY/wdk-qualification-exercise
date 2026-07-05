'use strict';

let tokenPromise = null;

async function mintCognitoToken() {
  const region = process.env.COGNITO_REGION || 'us-east-1';
  const clientId = process.env.COGNITO_CLIENT_ID;
  const username = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!clientId || !username || !password) {
    throw new Error(
      'Missing required env vars: COGNITO_CLIENT_ID, TEST_USER_EMAIL, TEST_USER_PASSWORD',
    );
  }

  const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `Cognito InitiateAuth failed (${response.status}): ${body.message || JSON.stringify(body)}`,
    );
  }

  if (!body.AuthenticationResult) {
    throw new Error(
      `Cognito returned a challenge (${body.ChallengeName}) instead of tokens — check the test user has USER_PASSWORD_AUTH enabled and no MFA/pending password change`,
    );
  }

  return body.AuthenticationResult.IdToken;
}

function ensureToken(context, ee, next) {
  if (!tokenPromise) {
    tokenPromise = mintCognitoToken();
  }

  tokenPromise
    .then((token) => {
      context.vars.token = token;
      next();
    })
    .catch((err) => {
      next(err);
    });
}

module.exports = { ensureToken };

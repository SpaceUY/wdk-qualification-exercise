/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "wdk-qualification-exercise",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: { region: "us-east-1", profile: "your-profile-name" },
      },
    };
  },
  async run() {
    const { userPoolId, userPoolClientId, cognitoDomain } =
      await import("./infra/cognito");

    return { userPoolId, userPoolClientId, cognitoDomain };
  },
});

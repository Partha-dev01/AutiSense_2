/**
 * Shared AWS credential provider for Amplify deployments.
 *
 * Amplify reserves the "AWS_*" env var prefix, so we use custom-named
 * variables: APP_ACCESS_KEY_ID, APP_SECRET_ACCESS_KEY, APP_REGION.
 * The SDK default credential chain is tried first (covers Lambda IAM
 * roles and local dev with AWS_* env vars). If that fails, the custom
 * env vars are used as an explicit fallback.
 */

import type { AwsCredentialIdentity } from "@aws-sdk/types";

/**
 * Returns explicit credentials from APP_* env vars if set,
 * or undefined to let the SDK use its default provider chain.
 */
export function getAppCredentials(): AwsCredentialIdentity | undefined {
  const accessKeyId = process.env.APP_ACCESS_KEY_ID;
  const secretAccessKey = process.env.APP_SECRET_ACCESS_KEY;

  if (accessKeyId && secretAccessKey) {
    return { accessKeyId, secretAccessKey };
  }

  return undefined;
}

/**
 * Returns the AWS region from APP_REGION, AWS_REGION, or the given default.
 */
export function getAppRegion(fallback = "ap-south-1"): string {
  return process.env.APP_REGION || process.env.AWS_REGION || fallback;
}

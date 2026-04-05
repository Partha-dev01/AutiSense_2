/**
 * Unit tests for the AWS credential provider.
 *
 * This module is used by all 8 SDK clients across the app. If the credential
 * chain breaks, every AWS-dependent feature fails (Polly, Bedrock, DynamoDB).
 *
 * Tests cover:
 * - Returns credentials when APP_* env vars are set
 * - Returns undefined when no APP_* env vars (SDK default chain)
 * - Region fallback chain: APP_REGION > AWS_REGION > default
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getAppCredentials", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns credentials when both APP_ACCESS_KEY_ID and APP_SECRET_ACCESS_KEY are set", async () => {
    process.env.APP_ACCESS_KEY_ID = "AKIATEST123456789012";
    process.env.APP_SECRET_ACCESS_KEY = "testSecretKey123456789012345678901234567890";

    const { getAppCredentials } = await import("../app/lib/aws/credentials");
    const creds = getAppCredentials();

    expect(creds).toBeDefined();
    expect(creds!.accessKeyId).toBe("AKIATEST123456789012");
    expect(creds!.secretAccessKey).toBe("testSecretKey123456789012345678901234567890");
  });

  it("returns undefined when APP_ACCESS_KEY_ID is missing", async () => {
    delete process.env.APP_ACCESS_KEY_ID;
    process.env.APP_SECRET_ACCESS_KEY = "testSecretKey";

    const { getAppCredentials } = await import("../app/lib/aws/credentials");
    expect(getAppCredentials()).toBeUndefined();
  });

  it("returns undefined when APP_SECRET_ACCESS_KEY is missing", async () => {
    process.env.APP_ACCESS_KEY_ID = "AKIATEST";
    delete process.env.APP_SECRET_ACCESS_KEY;

    const { getAppCredentials } = await import("../app/lib/aws/credentials");
    expect(getAppCredentials()).toBeUndefined();
  });

  it("returns undefined when both vars are empty strings", async () => {
    process.env.APP_ACCESS_KEY_ID = "";
    process.env.APP_SECRET_ACCESS_KEY = "";

    const { getAppCredentials } = await import("../app/lib/aws/credentials");
    expect(getAppCredentials()).toBeUndefined();
  });

  it("returns undefined when no env vars set (SDK default chain fallback)", async () => {
    delete process.env.APP_ACCESS_KEY_ID;
    delete process.env.APP_SECRET_ACCESS_KEY;

    const { getAppCredentials } = await import("../app/lib/aws/credentials");
    expect(getAppCredentials()).toBeUndefined();
  });
});

describe("getAppRegion", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns APP_REGION when set", async () => {
    process.env.APP_REGION = "eu-west-1";
    process.env.AWS_REGION = "us-east-1";

    const { getAppRegion } = await import("../app/lib/aws/credentials");
    expect(getAppRegion()).toBe("eu-west-1");
  });

  it("falls back to AWS_REGION when APP_REGION is not set", async () => {
    delete process.env.APP_REGION;
    process.env.AWS_REGION = "us-east-1";

    const { getAppRegion } = await import("../app/lib/aws/credentials");
    expect(getAppRegion()).toBe("us-east-1");
  });

  it("falls back to provided default when no region env vars set", async () => {
    delete process.env.APP_REGION;
    delete process.env.AWS_REGION;

    const { getAppRegion } = await import("../app/lib/aws/credentials");
    expect(getAppRegion("ap-south-1")).toBe("ap-south-1");
  });

  it("uses ap-south-1 as the default when no fallback provided", async () => {
    delete process.env.APP_REGION;
    delete process.env.AWS_REGION;

    const { getAppRegion } = await import("../app/lib/aws/credentials");
    expect(getAppRegion()).toBe("ap-south-1");
  });
});

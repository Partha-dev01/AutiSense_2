/**
 * DynamoDB operations for authentication.
 *
 * Tables:
 *   autisense-users          — PK: id (string)   GSI: email-index on email
 *   autisense-auth-sessions  — PK: token (string) with TTL on expiresAt
 *
 * If AWS credentials are not configured, falls back to an in-memory store
 * so local development works without any cloud dependency.
 */

import { AUTH_CONFIG } from "./config";

// ─── Types ───────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  googleId: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

export interface AuthSession {
  token: string;
  userId: string;
  expiresAt: number; // Unix epoch seconds (DynamoDB TTL)
  createdAt: string; // ISO-8601
}

// ─── AWS availability check ──────────────────────────────────────────
// On Amplify Lambda, credentials come via IAM role (SDK auto-detects).
// Only fall back to in-memory when DynamoDB actually fails or in local dev
// without any AWS config.
const dynamoFailed = false;

function shouldUseDynamo(): boolean {
  if (dynamoFailed) return false;
  // In local dev without any AWS config, skip DynamoDB
  if (
    process.env.NODE_ENV === "development" &&
    !process.env.AWS_ACCESS_KEY_ID &&
    !process.env.AWS_REGION
  ) {
    return false;
  }
  // In production (Amplify), always try DynamoDB — IAM role provides creds
  return true;
}

// ─── In-memory fallback for local dev ────────────────────────────────
const memoryUsers = new Map<string, AuthUser>();
const memoryUsersByEmail = new Map<string, AuthUser>();
const memorySessions = new Map<string, AuthSession>();

const memoryAdapter = {
  async createUser(user: AuthUser): Promise<AuthUser> {
    memoryUsers.set(user.id, user);
    memoryUsersByEmail.set(user.email, user);
    return user;
  },

  async getUserByEmail(email: string): Promise<AuthUser | null> {
    return memoryUsersByEmail.get(email) ?? null;
  },

  async getUserById(id: string): Promise<AuthUser | null> {
    return memoryUsers.get(id) ?? null;
  },

  async updateUser(id: string, updates: Partial<AuthUser>): Promise<AuthUser | null> {
    const existing = memoryUsers.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    memoryUsers.set(id, updated);
    memoryUsersByEmail.set(updated.email, updated);
    return updated;
  },

  async createAuthSession(session: AuthSession): Promise<AuthSession> {
    memorySessions.set(session.token, session);
    return session;
  },

  async getAuthSession(token: string): Promise<AuthSession | null> {
    const session = memorySessions.get(token) ?? null;
    if (session && session.expiresAt < Math.floor(Date.now() / 1000)) {
      memorySessions.delete(token);
      return null;
    }
    return session;
  },

  async deleteAuthSession(token: string): Promise<void> {
    memorySessions.delete(token);
  },
};

// ─── DynamoDB adapter ────────────────────────────────────────────────
async function getDynamoClient() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "ap-south-1",
  });
  return DynamoDBDocumentClient.from(client);
}

const USERS_TABLE = "autisense-users";
const SESSIONS_TABLE = "autisense-auth-sessions";

const dynamoAdapter = {
  async createUser(user: AuthUser): Promise<AuthUser> {
    const docClient = await getDynamoClient();
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await docClient.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: user,
      })
    );
    return user;
  },

  async getUserByEmail(email: string): Promise<AuthUser | null> {
    const docClient = await getDynamoClient();
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const result = await docClient.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: "email-index",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: { ":email": email },
        Limit: 1,
      })
    );
    return (result.Items?.[0] as AuthUser) ?? null;
  },

  async getUserById(id: string): Promise<AuthUser | null> {
    const docClient = await getDynamoClient();
    const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
    const result = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { id },
      })
    );
    return (result.Item as AuthUser) ?? null;
  },

  async updateUser(id: string, updates: Partial<AuthUser>): Promise<AuthUser | null> {
    const docClient = await getDynamoClient();
    const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb");

    // Build update expression dynamically
    const entries = Object.entries(updates).filter(([k]) => k !== "id");
    if (entries.length === 0) return this.getUserById(id);

    const exprParts: string[] = [];
    const exprNames: Record<string, string> = {};
    const exprValues: Record<string, unknown> = {};

    entries.forEach(([key, val], i) => {
      exprParts.push(`#f${i} = :v${i}`);
      exprNames[`#f${i}`] = key;
      exprValues[`:v${i}`] = val;
    });

    // Always update updatedAt
    exprParts.push("#upd = :updVal");
    exprNames["#upd"] = "updatedAt";
    exprValues[":updVal"] = new Date().toISOString();

    const result = await docClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { id },
        UpdateExpression: `SET ${exprParts.join(", ")}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ReturnValues: "ALL_NEW",
      })
    );
    return (result.Attributes as AuthUser) ?? null;
  },

  async createAuthSession(session: AuthSession): Promise<AuthSession> {
    const docClient = await getDynamoClient();
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await docClient.send(
      new PutCommand({
        TableName: SESSIONS_TABLE,
        Item: session,
      })
    );
    return session;
  },

  async getAuthSession(token: string): Promise<AuthSession | null> {
    const docClient = await getDynamoClient();
    const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
    const result = await docClient.send(
      new GetCommand({
        TableName: SESSIONS_TABLE,
        Key: { token },
      })
    );
    const session = result.Item as AuthSession | undefined;
    if (!session) return null;

    // Check expiry (DynamoDB TTL is not instant — belt-and-suspenders)
    if (session.expiresAt < Math.floor(Date.now() / 1000)) {
      await this.deleteAuthSession(token);
      return null;
    }
    return session;
  },

  async deleteAuthSession(token: string): Promise<void> {
    const docClient = await getDynamoClient();
    const { DeleteCommand } = await import("@aws-sdk/lib-dynamodb");
    await docClient.send(
      new DeleteCommand({
        TableName: SESSIONS_TABLE,
        Key: { token },
      })
    );
  },
};

// ─── Exported interface — auto-selects adapter ───────────────────────
function getAdapter() {
  if (shouldUseDynamo()) {
    return dynamoAdapter;
  }
  console.warn("[auth/dynamodb] Using in-memory store (DynamoDB unavailable)");
  return memoryAdapter;
}

export async function createUser(user: AuthUser): Promise<AuthUser> {
  return getAdapter().createUser(user);
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  return getAdapter().getUserByEmail(email);
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  return getAdapter().getUserById(id);
}

export async function updateUser(id: string, updates: Partial<AuthUser>): Promise<AuthUser | null> {
  return getAdapter().updateUser(id, updates);
}

export async function createAuthSession(session: AuthSession): Promise<AuthSession> {
  return getAdapter().createAuthSession(session);
}

export async function getAuthSession(token: string): Promise<AuthSession | null> {
  return getAdapter().getAuthSession(token);
}

export async function deleteAuthSession(token: string): Promise<void> {
  return getAdapter().deleteAuthSession(token);
}

/**
 * Create or update a user from Google profile data.
 * Returns the upserted user record.
 */
export async function upsertGoogleUser(profile: {
  id: string;
  email: string;
  name: string;
  picture: string;
}): Promise<AuthUser> {
  const adapter = getAdapter();
  const existing = await adapter.getUserByEmail(profile.email);

  if (existing) {
    // Update name/picture/googleId if they changed
    const updated = await adapter.updateUser(existing.id, {
      name: profile.name,
      picture: profile.picture,
      googleId: profile.id,
    });
    return updated!;
  }

  // New user
  const now = new Date().toISOString();
  const newUser: AuthUser = {
    id: crypto.randomUUID(),
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    googleId: profile.id,
    createdAt: now,
    updatedAt: now,
  };
  return adapter.createUser(newUser);
}

/**
 * Create a new auth session for a user.
 * Returns the session token (to be stored in a cookie).
 */
export async function createSessionForUser(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = Math.floor((now.getTime() + AUTH_CONFIG.sessionMaxAge) / 1000);

  await createAuthSession({
    token,
    userId,
    expiresAt,
    createdAt: now.toISOString(),
  });

  return token;
}

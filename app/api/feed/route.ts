import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/app/lib/auth/config";
import { getAuthSession, getUserById } from "@/app/lib/auth/dynamodb";
import { getAppCredentials, getAppRegion } from "@/app/lib/aws/credentials";

/**
 * Community Feed API — DynamoDB table: autisense-feed-posts
 * Table schema: PK = postId (S), SK = createdAt (N)
 */

const TABLE = "autisense-feed-posts";

interface FeedPostItem {
  postId: string;
  userId: string;
  content: string;
  category: string;
  reactions: { heart: number; helpful: number; relate: number };
  reactedBy: Record<string, string[]>;
  createdAt: number;
  anonymous: boolean;
}

// ─── In-memory fallback for local dev ────────────────────────────────
const memoryPosts: FeedPostItem[] = [];

// ─── DynamoDB client ─────────────────────────────────────────────────
let dynamoFailed = false;

async function getDynamo() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");
  const credentials = getAppCredentials();
  const client = new DynamoDBClient({
    region: getAppRegion("ap-south-1"),
    ...(credentials && { credentials }),
  });
  return DynamoDBDocumentClient.from(client);
}

function shouldUseDynamo(): boolean {
  if (
    process.env.NODE_ENV === "development" &&
    !process.env.AWS_ACCESS_KEY_ID &&
    !process.env.APP_ACCESS_KEY_ID &&
    !process.env.AWS_REGION
  ) {
    return false;
  }
  return !dynamoFailed;
}

// ─── Auth helper ─────────────────────────────────────────────────────
async function getUser(request: NextRequest) {
  const token = request.cookies.get(AUTH_CONFIG.sessionCookieName)?.value;
  if (!token) return null;
  try {
    const session = await getAuthSession(token);
    if (!session) return null;
    return getUserById(session.userId);
  } catch {
    return null;
  }
}

// ─── GET /api/feed — List posts ──────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const category = searchParams.get("category") || undefined;

  if (shouldUseDynamo()) {
    try {
      const docClient = await getDynamo();
      const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
      const result = await docClient.send(
        new ScanCommand({ TableName: TABLE, Limit: 200 }),
      );
      let posts = (result.Items || []) as FeedPostItem[];
      if (category) posts = posts.filter((p) => p.category === category);
      posts.sort((a, b) => b.createdAt - a.createdAt);
      return NextResponse.json({
        posts: posts.slice(0, limit).map(toClient),
        source: "dynamodb",
      });
    } catch (err) {
      console.error("[feed] DynamoDB GET failed, falling back:", err);
      dynamoFailed = true;
    }
  }

  // In-memory fallback
  let posts = [...memoryPosts];
  if (category) posts = posts.filter((p) => p.category === category);
  posts.sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({
    posts: posts.slice(0, limit).map(toClient),
    source: "memory",
  });
}

// ─── POST /api/feed — Create / React / Delete ────────────────────────
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "react") return handleReaction(body, user.id);
    if (action === "delete") return handleDelete(body, user.id);
    return handleCreate(body, user.id);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

// ─── Create post ─────────────────────────────────────────────────────
async function handleCreate(body: Record<string, unknown>, userId: string) {
  const { content, category, anonymous } = body;
  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  const validCategories = ["tip", "milestone", "question", "resource"];
  if (!validCategories.includes(category as string)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const now = Date.now();
  const post: FeedPostItem = {
    postId: crypto.randomUUID(),
    userId,
    content: (content as string).trim(),
    category: category as string,
    reactions: { heart: 0, helpful: 0, relate: 0 },
    reactedBy: { heart: [], helpful: [], relate: [] },
    createdAt: now,
    anonymous: anonymous !== false,
  };

  if (shouldUseDynamo()) {
    try {
      const docClient = await getDynamo();
      const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
      await docClient.send(new PutCommand({ TableName: TABLE, Item: post }));
      return NextResponse.json({ success: true, post: toClient(post), source: "dynamodb" });
    } catch (err) {
      console.error("[feed] DynamoDB PUT failed, falling back:", err);
      dynamoFailed = true;
    }
  }

  memoryPosts.push(post);
  return NextResponse.json({ success: true, post: toClient(post), source: "memory" });
}

// ─── React to a post ─────────────────────────────────────────────────
async function handleReaction(body: Record<string, unknown>, userId: string) {
  const { postId, createdAt, type } = body;
  if (!postId || !createdAt || !["heart", "helpful", "relate"].includes(type as string)) {
    return NextResponse.json({ error: "Invalid reaction — need postId, createdAt, type" }, { status: 400 });
  }

  const reactionType = type as "heart" | "helpful" | "relate";
  const key = { postId: postId as string, createdAt: createdAt as number };

  if (shouldUseDynamo()) {
    try {
      const docClient = await getDynamo();
      const { GetCommand, UpdateCommand } = await import("@aws-sdk/lib-dynamodb");
      const result = await docClient.send(
        new GetCommand({ TableName: TABLE, Key: key }),
      );
      const post = result.Item as FeedPostItem | undefined;
      if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

      const reactedBy = post.reactedBy || { heart: [], helpful: [], relate: [] };
      const users = reactedBy[reactionType] || [];
      const already = users.includes(userId);

      if (already) {
        const newUsers = users.filter((u: string) => u !== userId);
        await docClient.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: key,
            UpdateExpression: "SET reactions.#t = reactions.#t - :one, reactedBy.#t = :users",
            ExpressionAttributeNames: { "#t": reactionType },
            ExpressionAttributeValues: { ":one": 1, ":users": newUsers },
          }),
        );
        return NextResponse.json({ toggled: false });
      } else {
        await docClient.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: key,
            UpdateExpression: "SET reactions.#t = reactions.#t + :one, reactedBy.#t = list_append(if_not_exists(reactedBy.#t, :empty), :user)",
            ExpressionAttributeNames: { "#t": reactionType },
            ExpressionAttributeValues: { ":one": 1, ":user": [userId], ":empty": [] },
          }),
        );
        return NextResponse.json({ toggled: true });
      }
    } catch (err) {
      console.error("[feed] DynamoDB reaction failed, falling back:", err);
      dynamoFailed = true;
    }
  }

  // In-memory fallback
  const post = memoryPosts.find((p) => p.postId === (postId as string));
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (!post.reactedBy) post.reactedBy = { heart: [], helpful: [], relate: [] };
  const users = post.reactedBy[reactionType] || [];
  const already = users.includes(userId);
  if (already) {
    post.reactedBy[reactionType] = users.filter((u) => u !== userId);
    post.reactions[reactionType] = Math.max(0, post.reactions[reactionType] - 1);
    return NextResponse.json({ toggled: false });
  } else {
    post.reactedBy[reactionType] = [...users, userId];
    post.reactions[reactionType] += 1;
    return NextResponse.json({ toggled: true });
  }
}

// ─── Delete post ─────────────────────────────────────────────────────
async function handleDelete(body: Record<string, unknown>, userId: string) {
  const { postId, createdAt } = body;
  if (!postId || !createdAt) {
    return NextResponse.json({ error: "postId and createdAt required" }, { status: 400 });
  }

  const key = { postId: postId as string, createdAt: createdAt as number };

  if (shouldUseDynamo()) {
    try {
      const docClient = await getDynamo();
      const { GetCommand, DeleteCommand } = await import("@aws-sdk/lib-dynamodb");
      const result = await docClient.send(
        new GetCommand({ TableName: TABLE, Key: key }),
      );
      const post = result.Item as FeedPostItem | undefined;
      if (!post || post.userId !== userId) {
        return NextResponse.json({ error: "Not found or not authorized" }, { status: 403 });
      }
      await docClient.send(new DeleteCommand({ TableName: TABLE, Key: key }));
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[feed] DynamoDB delete failed, falling back:", err);
      dynamoFailed = true;
    }
  }

  const idx = memoryPosts.findIndex((p) => p.postId === (postId as string) && p.userId === userId);
  if (idx === -1) return NextResponse.json({ error: "Not found or not authorized" }, { status: 403 });
  memoryPosts.splice(idx, 1);
  return NextResponse.json({ success: true });
}

// ─── Map DynamoDB item to client format ──────────────────────────────
function toClient(post: FeedPostItem) {
  return {
    id: post.postId,
    postId: post.postId,
    userId: post.userId,
    content: post.content,
    category: post.category,
    reactions: post.reactions,
    reactedBy: post.reactedBy || { heart: [], helpful: [], relate: [] },
    createdAt: post.createdAt,
    anonymous: post.anonymous,
  };
}

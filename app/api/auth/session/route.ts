/**
 * GET /api/auth/session
 *
 * Returns the current authenticated user's data.
 * Reads the session cookie, validates against DynamoDB,
 * and returns user info or a 401.
 */
import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/app/lib/auth/config";
import { getAuthSession, getUserById } from "@/app/lib/auth/dynamodb";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_CONFIG.sessionCookieName)?.value;

  if (!token) {
    return NextResponse.json({ user: null, authenticated: false }, { status: 401 });
  }

  try {
    const session = await getAuthSession(token);
    if (!session) {
      return NextResponse.json({ user: null, authenticated: false }, { status: 401 });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ user: null, authenticated: false }, { status: 401 });
    }

    // Return user data (strip internal fields)
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
      authenticated: true,
    });
  } catch (err) {
    console.error("[auth/session] Error validating session:", err);
    return NextResponse.json({ user: null, authenticated: false }, { status: 401 });
  }
}

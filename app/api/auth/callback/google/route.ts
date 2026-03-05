/**
 * GET /api/auth/callback/google
 *
 * Handles the OAuth callback from Google:
 *  1. Validates CSRF state
 *  2. Exchanges authorization code for tokens
 *  3. Fetches user profile from Google
 *  4. Creates/updates user in DynamoDB
 *  5. Creates auth session
 *  6. Sets session cookie
 *  7. Redirects to /dashboard
 */
import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/app/lib/auth/config";
import { upsertGoogleUser, createSessionForUser } from "@/app/lib/auth/dynamodb";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const { appUrl, google, oauthStateCookieName, sessionCookieName, sessionMaxAgeSeconds } =
    AUTH_CONFIG;

  // ─── Error from Google ──────────────────────────────────────────
  if (error) {
    console.error("[auth/callback/google] OAuth error:", error);
    return NextResponse.redirect(`${appUrl}/auth/login?error=${encodeURIComponent(error)}`);
  }

  // ─── Missing code or state ─────────────────────────────────────
  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/auth/login?error=missing_params`);
  }

  // ─── CSRF validation ──────────────────────────────────────────
  const storedState = request.cookies.get(oauthStateCookieName)?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${appUrl}/auth/login?error=invalid_state`);
  }

  try {
    // ─── Exchange code for tokens ─────────────────────────────────
    const tokenResponse = await fetch(google.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: AUTH_CONFIG.googleClientId,
        client_secret: AUTH_CONFIG.googleClientSecret,
        redirect_uri: `${appUrl}/api/auth/callback/google`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error("[auth/callback/google] Token exchange failed:", errorBody);
      return NextResponse.redirect(`${appUrl}/auth/login?error=token_exchange_failed`);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      id_token?: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };

    // ─── Fetch user profile ───────────────────────────────────────
    const profileResponse = await fetch(google.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileResponse.ok) {
      console.error("[auth/callback/google] Profile fetch failed:", profileResponse.status);
      return NextResponse.redirect(`${appUrl}/auth/login?error=profile_fetch_failed`);
    }

    const profile = (await profileResponse.json()) as {
      id: string;
      email: string;
      name: string;
      picture: string;
    };

    // ─── Upsert user in DynamoDB ──────────────────────────────────
    const user = await upsertGoogleUser({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });

    // ─── Create session ───────────────────────────────────────────
    const sessionToken = await createSessionForUser(user.id);

    // ─── Set cookie & redirect ────────────────────────────────────
    const response = NextResponse.redirect(`${appUrl}/kid-dashboard`);

    response.cookies.set(sessionCookieName, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionMaxAgeSeconds,
      path: "/",
    });

    // Clear the OAuth state cookie
    response.cookies.delete(oauthStateCookieName);

    return response;
  } catch (err) {
    console.error("[auth/callback/google] Unexpected error:", err);
    return NextResponse.redirect(`${appUrl}/auth/login?error=server_error`);
  }
}

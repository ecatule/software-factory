import { Body, Controller, Get, Post, Query, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { JwtService } from "@nestjs/jwt";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { OidcService } from "./oidc.service";
import { Public } from "./public.decorator";

const REFRESH_COOKIE_NAME = "refresh_token";
const STATE_SECRET = process.env.JWT_ACCESS_SECRET ?? "change-me";

interface OidcState {
  verifier: string;
  redirect: string;
}

/** None of these routes require a pre-existing access token — see Public(). */
@ApiTags("auth")
@Controller("auth")
@Public()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oidcService: OidcService,
    private readonly jwt: JwtService,
  ) {}

  /** contracts/auth.md: GET /auth/login — redirects to the IdP with PKCE. */
  @Get("login")
  async login(@Query("redirect") redirect: string | undefined, @Res() res: Response) {
    const verifier = this.oidcService.generateCodeVerifier();
    const state = this.jwt.sign(
      { verifier, redirect: redirect ?? "/" } satisfies OidcState,
      { secret: STATE_SECRET, expiresIn: "10m" },
    );
    const url = await this.oidcService.buildAuthorizationUrl(state, verifier);
    res.redirect(url);
  }

  /** contracts/auth.md: GET /auth/callback — code exchange, set httpOnly refresh cookie. */
  @Get("callback")
  async callback(@Req() req: Request, @Res() res: Response) {
    const { state } = req.query as { state?: string };
    if (!state) {
      return res.status(401).send("Missing OIDC state");
    }

    let decoded: OidcState;
    try {
      decoded = this.jwt.verify(state, { secret: STATE_SECRET });
    } catch {
      return res.status(401).send("Invalid or expired sign-in attempt — please try again.");
    }

    const callbackUrl = process.env.OIDC_REDIRECT_URI ?? "http://localhost:3000/api/v1/auth/callback";
    try {
      const tokenSet = await this.oidcService.exchangeCode(
        callbackUrl,
        req.query as Record<string, string>,
        decoded.verifier,
        state,
      );
      const claims = tokenSet.claims();
      const email = claims.email as string | undefined;
      if (!email) {
        return res.status(401).send("Identity provider did not return an email claim.");
      }

      // Only the refresh token is needed here — the SPA fetches its own
      // access token via GET /auth/session right after this redirect.
      const { refreshToken } = await this.authService.issueTokensForVerifiedIdentity(email);
      this.setRefreshCookie(res, refreshToken);

      const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
      res.redirect(`${webOrigin}${decoded.redirect}?signedIn=1`);
    } catch (error) {
      res.status(401).send(
        error instanceof Error
          ? `Sign-in failed: ${error.message}`
          : "Sign-in failed — unknown identity or provider error.",
      );
    }
  }

  /** contracts/auth.md: GET /auth/session — bootstrap an access token from the refresh cookie. */
  @Get("session")
  async session(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      return res.status(401).json({ message: "No active session" });
    }
    try {
      const { accessToken, refreshToken: nextRefreshToken } =
        await this.authService.refresh(refreshToken);
      this.setRefreshCookie(res, nextRefreshToken);
      const payload = this.jwt.decode(accessToken) as {
        sub: string;
        email: string;
        roles: string[];
        permissions: string[];
      };
      res.json({
        accessToken,
        user: {
          id: payload.sub,
          email: payload.email,
          roles: payload.roles,
          permissions: payload.permissions,
        },
      });
    } catch {
      res.status(401).json({ message: "Session expired — please sign in again." });
    }
  }

  /** Existing 001 endpoint — kept for non-browser callers managing their own refresh token. */
  @Post("refresh")
  refresh(@Body("refreshToken") refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post("logout")
  logout(@Res() res: Response) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/v1/auth" });
    res.status(204).send();
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/v1/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}

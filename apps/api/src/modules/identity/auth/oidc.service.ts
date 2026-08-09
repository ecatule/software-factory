import { Injectable, Logger } from "@nestjs/common";
import { Issuer, generators, type Client, type TokenSet } from "openid-client";

/**
 * spec 002 research.md §2: Authorization Code + PKCE, mediated entirely
 * server-side. Discovery is lazy (not on module boot) so the API still
 * starts cleanly in environments without an OIDC provider configured yet —
 * only `/auth/login` actually needs it.
 */
@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private client: Client | null = null;

  private async getClient(): Promise<Client> {
    if (this.client) return this.client;

    const issuerUrl = process.env.OIDC_ISSUER_URL;
    if (!issuerUrl) {
      throw new Error(
        "OIDC_ISSUER_URL is not configured — set it, OIDC_CLIENT_ID, and (if required by " +
          "your provider) OIDC_CLIENT_SECRET before using /auth/login.",
      );
    }

    const issuer = await Issuer.discover(issuerUrl);
    this.client = new issuer.Client({
      client_id: process.env.OIDC_CLIENT_ID ?? "",
      client_secret: process.env.OIDC_CLIENT_SECRET,
      redirect_uris: [
        process.env.OIDC_REDIRECT_URI ?? "http://localhost:3000/api/v1/auth/callback",
      ],
      response_types: ["code"],
    });
    this.logger.log(`OIDC client discovered against ${issuerUrl}`);
    return this.client;
  }

  generateCodeVerifier(): string {
    return generators.codeVerifier();
  }

  async buildAuthorizationUrl(state: string, codeVerifier: string): Promise<string> {
    const client = await this.getClient();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    return client.authorizationUrl({
      scope: "openid email profile",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
  }

  async exchangeCode(
    callbackUrl: string,
    receivedParams: Record<string, string>,
    codeVerifier: string,
    expectedState: string,
  ): Promise<TokenSet> {
    const client = await this.getClient();
    return client.callback(callbackUrl, receivedParams, {
      code_verifier: codeVerifier,
      state: expectedState,
    });
  }
}

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../../common/prisma/prisma.service";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Issues platform JWTs after a user has been authenticated by an upstream
 * OAuth2/OIDC identity provider. Which IdP is used is a per-deployment
 * configuration choice (research.md §7) — this service only needs a
 * verified subject/email, not the IdP's own protocol details.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async issueTokensForVerifiedIdentity(email: string): Promise<TokenPair> {
    const user = await this.prisma.db.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new UnauthorizedException("Unknown identity");
    }

    const roles = user.roles.map((userRole) => userRole.role.name);
    const payload = { sub: user.id, email: user.email, roles };

    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? "change-me",
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? "change-me-too",
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
    });

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? "change-me-too",
      });
      return this.issueTokensForVerifiedIdentity(payload.email);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }
}

/**
 * AgentFlow Gateway — JWT Auth Plugin with RBAC
 *
 * Registers @fastify/jwt and a `preHandler` that:
 *   1. Verifies the JWT signature
 *   2. Attaches the decoded payload to request.user
 *   3. Provides authenticate() and requireRole() decorators
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { getSecret, createLogger } from "@agentflow/shared";

const log = createLogger({ name: "gateway:auth" });

export type JwtPayload = {
  sub: string; // userId
  workspaceId: string;
  email: string;
  role: "admin" | "developer" | "operator" | "readonly";
  iat: number;
  exp: number;
};

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export const authPlugin: FastifyPluginAsync = async (fastify) => {
  const jwtSecret = getSecret("JWT_SECRET", true);

  await fastify.register(fastifyJwt, {
    secret: jwtSecret,
    verify: {
      // Allow up to 60s clock skew
      clockTolerance: 60,
    },
  });

  // ── Decorator: authenticate ─────────────────────────────────────────────
  fastify.decorate(
    "authenticate",
    async function (
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      try {
        await request.jwtVerify();
      } catch (err) {
        log.warn(
          { err, path: request.url },
          "JWT verification failed",
        );
        await reply.status(401).send({
          error: "UNAUTHORIZED",
          message: "Missing or invalid authorization token",
        });
      }
    },
  );

  // ── Decorator: requireRole ────────────────────────────────────────────────
  fastify.decorate(
    "requireRole",
    function (
      allowedRoles: JwtPayload["role"][],
    ): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
      return async (req: FastifyRequest, reply: FastifyReply) => {
        // First verify JWT
        try {
          await req.jwtVerify();
        } catch {
          await reply.status(401).send({
            error: "UNAUTHORIZED",
            message: "Missing or invalid authorization token",
          });
          return;
        }

        if (!allowedRoles.includes(req.user.role)) {
          log.warn(
            { userId: req.user.sub, role: req.user.role, required: allowedRoles },
            "RBAC check failed",
          );
          await reply.status(403).send({
            error: "FORBIDDEN",
            message: `This action requires one of: ${allowedRoles.join(", ")}`,
          });
        }
      };
    },
  );
};

// Type augmentation for Fastify instance
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      roles: JwtPayload["role"][],
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

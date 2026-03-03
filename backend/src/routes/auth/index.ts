import { FastifyInstance } from "fastify";
import signupRoutes from "./signup.js";
import loginRoutes from "./login.js";
import walletRoutes from "./wallet.js";
import profileRoutes from "./profile.js";
import emailVerificationRoutes from "./email-verification.js";
import passwordRoutes from "./password.js";

export default async function authRoutes(app: FastifyInstance) {
  app.register(signupRoutes);
  app.register(loginRoutes);
  app.register(walletRoutes);
  app.register(profileRoutes);
  app.register(emailVerificationRoutes);
  app.register(passwordRoutes);
}

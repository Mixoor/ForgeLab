import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { db } from "../database";

const SALT_ROUNDS = 10; 
const JWT_SECRET =
  process.env.JWT_SECRET || "super_secret_anvil_encryption_key";

export class AuthController {
  public static async register(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { email, username, password,firstName,lastName } = req.body;

      if (!email || !username || !password) {
        res
          .status(400)
          .json({
            error: "All fields (email, username, password) are required.",
          });
        return;
      }

      if (password.length < 8) {
        res
          .status(400)
          .json({ error: "Password must be at least 8 characters long." });
        return;
      }

      // Check for identity attribute collisions
      const existingUser = await db.user.findFirst({
        where: { OR: [{ email }, { username }] },
      });

      if (existingUser) {
        res.status(409).json({
          error:
            existingUser.email === email
              ? "Email is already registered."
              : "Username is already taken.",
        });
        return;
      }

      // Securely hash the plain text password input
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Save user profile node
      const user = await db.user.create({
        data: { email, username, passwordHash, firstName, lastName },
        select: { id: true, email: true, username: true, firstName: true, lastName: true },
      });

      // Generate a signed token session artifact immediately on signup
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      res.status(201).json({ user, token });
    } catch (error) {
      next(error);
    }
  }

  public static async login(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { identity, password } = req.body; // 'identity' can be either email or username

      if (!identity || !password) {
        res
          .status(400)
          .json({
            error: "Identity (email/username) and password are required.",
          });
        return;
      }

      // Find user matching either unique constraint
      const user = await db.user.findFirst({
        where: {
          OR: [{ email: identity }, { username: identity }],
        },
      });

      if (!user) {
        res.status(401).json({ error: "Invalid login credentials." });
        return;
      }

      // Compare incoming text with the cryptographically salted database hash record
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (!isPasswordValid) {
        res.status(401).json({ error: "Invalid login credentials." });
        return;
      }

      // Generate JWT Token payload
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        token,
      });
    } catch (error) {
      next(error);
    }
  }
}

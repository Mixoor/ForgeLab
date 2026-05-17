
import "dotenv/config";

import { PrismaClient } from "../generated/client";
import { PrismaPg } from "@prisma/adapter-pg";


const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });

// Export the Prisma client instance for use in other parts of the application
class Prisma {
  private static instance: PrismaClient | null = null;

  constructor() {
    if (!Prisma.instance) {
      Prisma.instance = new PrismaClient({
        adapter,
        log: ['query', 'info', 'warn', 'error'],
      });
    }
  }
  static getPrismaClientClass() {
    return PrismaClient;
  }

  getInstance(): PrismaClient {
    return Prisma.instance as PrismaClient;
  }
}

const db = new Prisma().getInstance();

export { db };

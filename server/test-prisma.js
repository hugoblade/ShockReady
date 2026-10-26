import "dotenv/config";
import { prisma } from "./src/config/prisma.js";

try {
  await prisma.$connect();

  const result = await prisma.$queryRaw`SELECT 1 AS connection_test`;

  console.log("Database connection successful!");
  console.log("Test result:", result);
} catch (error) {
  console.error("Database connection failed:");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
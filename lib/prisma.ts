
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const host = process.env.DATABASE_HOST;
const user = process.env.DATABASE_USER;
const password = process.env.DATABASE_PASSWORD;
const database = process.env.DATABASE_NAME;

if (!host || !user || !password || !database) {
  throw new Error("Thiếu cấu hình kết nối DATABASE_*");
}

const port = Number(process.env.DATABASE_PORT ?? 4000);

const adapter = new PrismaMariaDb({
  host,
  port,
  user,
  password,
  database,

  // TiDB Cloud Public Endpoint: bật TLS
  ssl: true,

  // Thời gian chờ tạo kết nối
  connectTimeout: 10000,

  // Thời gian chờ lấy kết nối từ pool
  acquireTimeout: 15000,

  // Giới hạn kết nối mỗi instance
  connectionLimit: 3,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

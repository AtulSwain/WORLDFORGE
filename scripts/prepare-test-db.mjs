// Applies migrations to the integration-test database named by DATABASE_URL_TEST.
import "dotenv/config";
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL_TEST;
if (!url) {
  console.error("DATABASE_URL_TEST is not set. Point it at a disposable database (never your real data).");
  process.exit(1);
}
if (url === process.env.DATABASE_URL) {
  console.error("DATABASE_URL_TEST must differ from DATABASE_URL.");
  process.exit(1);
}
execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });

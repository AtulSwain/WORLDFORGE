import "dotenv/config";

// Integration tests run against a dedicated database. Never point this at real data.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

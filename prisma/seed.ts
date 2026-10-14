/**
 * Deterministic development seed. Idempotent: running it twice does not duplicate data.
 *   Demo account: demo@worldforge.dev / worldforge-demo
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { instantiateSampleUniverse } from "../src/sample/instantiate";

const DEMO_EMAIL = "demo@worldforge.dev";
const DEMO_PASSWORD = "worldforge-demo";

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    let user = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (!user) {
      user = await db.user.create({
        data: { email: DEMO_EMAIL, name: "Demo Archivist", passwordHash: await hashPassword(DEMO_PASSWORD), preferences: { create: {} } },
      });
      console.log(`Created demo user ${DEMO_EMAIL}`);
    }
    const existing = await db.universe.findFirst({ where: { ownerId: user.id, isSample: true } });
    if (existing) {
      console.log(`Sample universe already present (${existing.slug}); skipping.`);
      return;
    }
    const id = await instantiateSampleUniverse(db, user.id, { isSample: true });
    console.log(`Seeded “The Ashen Crown” (${id}).`);
    console.log(`Sign in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

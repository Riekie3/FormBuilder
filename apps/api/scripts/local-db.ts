/**
 * Convenience local Postgres for machines without Docker installed.
 * Downloads a real Postgres binary on first run and keeps it running in the
 * foreground until Ctrl+C. Production and Docker-based dev should use the
 * docker-compose "postgres" service instead — this script exists purely so
 * `npm run db:local` works with zero extra setup.
 */
import EmbeddedPostgres from "embedded-postgres";
import path from "path";

const DATA_DIR = path.join(__dirname, "..", ".pgdata");
const PORT = 54329;
const DB_NAME = "smart_form_builder";
const TEST_DB_NAME = "smart_form_builder_test";

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: true,
  });

  const fs = await import("fs");
  const alreadyInitialised = fs.existsSync(path.join(DATA_DIR, "PG_VERSION"));
  if (!alreadyInitialised) {
    console.log("Initialising local Postgres data directory...");
    await pg.initialise();
  }

  await pg.start();

  for (const name of [DB_NAME, TEST_DB_NAME]) {
    try {
      await pg.createDatabase(name);
    } catch {
      // Database already exists — fine.
    }
  }

  const url = `postgresql://postgres:postgres@localhost:${PORT}/${DB_NAME}`;
  const testUrl = `postgresql://postgres:postgres@localhost:${PORT}/${TEST_DB_NAME}`;
  console.log(`\nLocal Postgres is running.\nDATABASE_URL=${url}\nTest DB=${testUrl}\n\nPress Ctrl+C to stop.`);

  const shutdown = async () => {
    console.log("\nStopping local Postgres...");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

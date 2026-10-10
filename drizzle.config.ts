import type { Config } from "drizzle-kit";

const rawUrl = process.env.DATABASE_URL || "./lavamusic-pgdata";
const isPgLite =
	!rawUrl.startsWith("postgres://") && !rawUrl.startsWith("postgresql://");
const dbUrl = isPgLite ? rawUrl.replace(/^file:/, "") : rawUrl;

const config: Config = {
	out: "./drizzle/postgres",
	schema: "./src/database/schemas.ts",
	dialect: "postgresql",
	dbCredentials: { url: dbUrl },
};

// Only add driver for PGLite
if (isPgLite) {
	config.driver = "pglite";
}

export default config;

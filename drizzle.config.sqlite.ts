import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL || "file:./lavamusic.db";

export default defineConfig({
	out: "./drizzle/sqlite",
	schema: "./src/database/schemas.sqlite.ts",
	dialect: "sqlite",
	dbCredentials: { url: databaseUrl },
});

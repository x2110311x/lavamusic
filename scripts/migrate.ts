import { Database } from "bun:sqlite";
import { resolve } from "node:path";

const databaseUrl = process.env.DATABASE_URL || "file:./lavamusic-pgdata";

enum DatabaseType {
	Postgres = "postgres",
	PGLite = "pglite",
	SQLite = "sqlite",
}

function detectDatabaseType(url?: string): DatabaseType {
	if (!url) return DatabaseType.PGLite;
	if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
		return DatabaseType.Postgres;
	}
	if (
		url.startsWith("sqlite:") ||
		url.endsWith(".db") ||
		url.endsWith(".sqlite") ||
		url.endsWith(".sqlite3")
	) {
		return DatabaseType.SQLite;
	}
	if (url.startsWith("file:")) {
		if (url.includes("?")) return DatabaseType.SQLite;
		if (/\.(db|sqlite3?)$/i.test(url)) return DatabaseType.SQLite;
		return DatabaseType.PGLite;
	}
	return DatabaseType.PGLite;
}

async function runMigrations() {
	const dbType = detectDatabaseType(databaseUrl);
	console.log(`🔄 Synchronizing schema for ${dbType}...`);

	if (dbType === DatabaseType.Postgres) {
		const { Pool } = await import("pg");
		const { drizzle } = await import("drizzle-orm/node-postgres");
		const { migrate } = await import("drizzle-orm/node-postgres/migrator");

		const pool = new Pool({ connectionString: databaseUrl });
		const db = drizzle(pool);
		await migrate(db, { migrationsFolder: resolve("./drizzle/postgres") });
		await pool.end();
		console.log("✅ PostgreSQL schema synced successfully.");
	} else if (dbType === DatabaseType.PGLite) {
		console.log("DEBUG: Step 1 - importing dependencies");
		const { existsSync } = await import("node:fs");
		const { PGlite } = await import("@electric-sql/pglite");
		const { drizzle } = await import("drizzle-orm/pglite");
		const { migrate } = await import("drizzle-orm/pglite/migrator");

		const dataDir = databaseUrl.replace(/^file:/, "") || "./lavamusic-pgdata";
		const distPath = resolve("./dist");
		const wasmPath = resolve(distPath, "pglite.wasm");
		const dataPath = resolve(distPath, "pglite.data");

		console.log("DEBUG: Step 2 - dataDir:", dataDir, "wasm exists:", existsSync(wasmPath), "data exists:", existsSync(dataPath));

		let client: any;
		if (existsSync(wasmPath) && existsSync(dataPath)) {
			console.log("DEBUG: Step 3 - reading wasm and data files");
			const [wasmBuffer, dataBuffer] = await Promise.all([
				Bun.file(wasmPath).arrayBuffer(),
				Bun.file(dataPath).arrayBuffer(),
			]);
			console.log("DEBUG: Step 4 - compiling wasm module");
			const wasmModule = await WebAssembly.compile(wasmBuffer);
			const fsBundle = new Blob([dataBuffer]);
			console.log("DEBUG: Step 5 - calling PGlite.create");
			client = await PGlite.create(dataDir, { wasmModule, fsBundle });
		} else {
			console.log("DEBUG: Step 3b - fallback PGlite.create");
			client = await PGlite.create(dataDir);
		}
		console.log("DEBUG: Step 6 - waiting ready");
		await client.waitReady;

		console.log("DEBUG: Step 7 - creating drizzle instance");
		const db = drizzle(client);
		console.log("DEBUG: Step 8 - running migrate()");
		await migrate(db, { migrationsFolder: resolve("./drizzle/postgres") });
		console.log("DEBUG: Step 9 - closing client");
		await client.close();
		console.log("✅ PGLite schema synced successfully.");
	} else if (dbType === DatabaseType.SQLite) {
		const { drizzle } = await import("drizzle-orm/bun-sqlite");
		const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
		const { dirname, resolve: pathResolve } = await import("node:path");
		const { mkdirSync } = await import("node:fs");

		const path = databaseUrl.replace(/^file:/, "").replace(/^sqlite:/, "") || "./lavamusic.db";
		mkdirSync(dirname(pathResolve(path)), { recursive: true });

		const sqlite = new Database(path);
		const db = drizzle(sqlite);
		try {
			await migrate(db, { migrationsFolder: resolve("./drizzle/sqlite") });
			console.log("✅ SQLite schema synced successfully.");
		} catch (err: any) {
			if (
				err?.message?.includes("already exists") ||
				err?.cause?.message?.includes("already exists")
			) {
				console.log("ℹ️ SQLite tables already exist, skipping initial migration.");
			} else {
				throw err;
			}
		} finally {
			sqlite.close();
		}
	}
}

runMigrations()
	.then(() => {
		console.log("✅ Database is ready.");
		process.exit(0);
	})
	.catch((err) => {
		console.error("❌ Database migration failed:", err);
		process.exit(1);
	});

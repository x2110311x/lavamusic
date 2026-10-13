import { Events } from "discord.js";
import { AutoPoster } from "topgg-autoposter";
import { env } from "../../env";
import { Event, type Lavamusic } from "../../structures/index";
import logger from "../../structures/Logger";
import { LavamusicEventType } from "../../types/events";
export default class Ready extends Event {
	constructor(client: Lavamusic, file: string) {
		super(client, file, {
			type: LavamusicEventType.Client,
			name: Events.ClientReady,
		});
	}

	public async run(): Promise<void> {
		logger.success(`${this.client.user?.tag} is ready!`);

		this.client.user?.setPresence({
			activities: [
				{
					name: env.BOT_ACTIVITY,
					type: env.BOT_ACTIVITY_TYPE,
				},
			],
			status: env.BOT_STATUS as any,
		});

		if (env.TOPGG) {
			const autoPoster = AutoPoster(env.TOPGG, this.client);
			autoPoster.on("posted", (_stats) => {
				logger.info("Successfully posted stats to Top.gg!");
			});
		} else {
			logger.warn("Top.gg token not found. Skipping auto poster.");
		}
		if (env.GUILD_ID) {
			await this.client.syncCommands(env.GUILD_ID).catch((err) => {
				logger.error("Failed to auto-sync commands to GUILD_ID:", err);
			});
		}
		await this.client.manager.init({ ...this.client.user!, shards: "auto" });
	}
}

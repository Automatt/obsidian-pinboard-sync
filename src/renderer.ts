import { App } from "obsidian";
import { ISettings } from "./settings";
//import { ISubTask, ITask } from "./things";
import { getHeadingLevel, getTab, groupBy, toHeading } from "./textUtils";
import { PinboardPost, PinboardPostCollection } from "./pbsdk";
import dedent from "dedent";
import moment from "moment";

export class PinRenderer {
	private app: App;
	private settings: ISettings;

	constructor(app:App, settings: ISettings) {
		this.app = app;
		this.settings = settings;
		this.renderPin = this.renderPin.bind(this);
	}

	/**
	 * Santizes and ensures prefix is added to tag names
	 * @param omitHash whether to leave out the hash, useful for things like properties blocks
	*/
	renderTags(pin: PinboardPost, omitHash?: boolean) {
		const prefix = this.settings.tagPrefix;

		let tagNames: string[] = [];
		pin.tags.forEach(t => tagNames.push(t.name));

		return tagNames.filter((tag) => !!tag)
			.map((tag) => tag.replace(/\s+/g, "-").toLowerCase())
			.map((tag) => `${omitHash ? '' : '#'}${prefix}${tag}`);
	}

	renderPin(pin: PinboardPost): string {

		const vault = this.app.vault as any;
		const tab = getTab(vault.getConfig("useTab"), vault.getConfig("tabSize"));

		let tagNames: string[] = [];
        pin.tags.forEach(t => tagNames.push(t.name));

		const tags = this.renderTags(pin).join(" ");

      	const extended = pin.extended;
 
      	const linkText = `- [${pin.description}](${pin.href}) ${extended} ${tags}`.trimEnd()

      	return linkText;
		
	}

	public renderPinProperties(pin: PinboardPost): string {
		return dedent`---
			href: ${pin.href}
			tags: ${[this.settings.oneNotePerPinTag, ...this.renderTags(pin, true)].join(', ')}
			description: ${pin.description}
			extended: ${pin.extended}
			time: ${moment(pin.time).toISOString()}
			to-read: ${pin.toread}
			shared: ${pin.shared}
			---
		`;
	}

	public render(pins: PinboardPost[]): string {
		const { sectionHeading } = this.settings;
		const headingLevel = getHeadingLevel(sectionHeading);

		const output = [sectionHeading];
		output.push(...pins.map(this.renderPin));

		return output.join("\n")

	}

}
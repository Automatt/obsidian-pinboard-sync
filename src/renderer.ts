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
	 * Sanitizes and ensures prefix is added to tag names
	 * @param omitHash whether to leave out the hash, useful for things like properties blocks
	*/
	renderTags(pin: PinboardPost, omitHash?: boolean) {
		const prefix = this.settings.tagPrefix;

		let tagNames: string[] = [];
		pin.tags.forEach(t => tagNames.push(t.name));

		const filteredTags = tagNames.filter((tag) => !!tag);

		const sanitizedTags = filteredTags.map((tag) => {
			const withDashes = tag.replace(/:/g, "-").replace(/\s+/g, "-");
			return withDashes.toLowerCase();
		});

		const finalTags = sanitizedTags.map((tag) => `${omitHash ? '' : '#'}${prefix}${tag}`);

		return finalTags;
	}

	renderPin(pin: PinboardPost): string {

		const vault = this.app.vault as any;
		const tab = getTab(vault.getConfig("useTab"), vault.getConfig("tabSize"));

		let tagNames: string[] = [];
        pin.tags.forEach(t => tagNames.push(t.name));

		const tags = this.renderTags(pin).join(" ");

      	const extended = pin.extended;
 
		const separator = this.settings.newlineSeparator ? "\n  " : " "
      	const linkText = `- [${pin.description}](${pin.href})${separator}${extended}${separator}${tags}`.trimEnd()

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
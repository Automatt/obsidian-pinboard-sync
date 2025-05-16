import { App } from "obsidian";
import { ISettings } from "./settings";
//import { ISubTask, ITask } from "./things";
import { getHeadingLevel, getTab, groupBy, toHeading } from "./textUtils";
import { PinboardPost, PinboardPostCollection } from "./pbsdk";

export class PinRenderer {
	private app: App;
	private settings: ISettings;

	constructor(app:App, settings: ISettings) {
		this.app = app;
		this.settings = settings;
		this.renderPin = this.renderPin.bind(this);
	}

	renderPin(pin: PinboardPost): string {

		const vault = this.app.vault as any;
		const tab = getTab(vault.getConfig("useTab"), vault.getConfig("tabSize"));
		const prefix = this.settings.tagPrefix;

		let tagNames: string[] = [];
        pin.tags.forEach(t => tagNames.push(t.name));

		const tags = tagNames.filter((tag) => !!tag)
      		.map((tag) => tag.replace(/\s+/g, "-").toLowerCase())
      		.map((tag) => `#${prefix}${tag}`)
      		.join(" ");

      	const extended = pin.extended;
 
		const separator = this.settings.newlineSeparator ? "\n  " : " "
      	const linkText = `- [${pin.description}](${pin.href})${separator}${extended}${separator}${tags}`.trimEnd()

      	return linkText;
	}

	public render(pins: PinboardPost[]): string {
		const { sectionHeading } = this.settings;
		const headingLevel = getHeadingLevel(sectionHeading);

		const output = [sectionHeading];
		output.push(...pins.map(this.renderPin));

		return output.join("\n")

	}

}
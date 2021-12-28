import { App, PluginSettingTab, Setting } from "obsidian";

import type PinboardSyncPlugIn from "./main";

export const DEFAULT_SECTION_HEADING = "## Pinboard";
export const DEFAULT_SYNC_FREQUENCY_SECONDS = 30 * 60; // Every 30 minutes
export const DEFAULT_TAG_PREFIX = "pinboard/";
export const DEFAULT_PIN_TOKEN = "Username:SecretTokenCode"
export const DEFAULT_RECENT_COUNT = 20;

export interface ISettings {
  apiToken: string;
  hasAcceptedDisclaimer: boolean;
  latestSyncTime: number;

  isSyncEnabled: boolean;
  sectionHeading: string;
  syncInterval: number;
  tagPrefix: string;
  recentCount: number;
}

export const DEFAULT_SETTINGS = Object.freeze({
  apiToken: DEFAULT_PIN_TOKEN,
  hasAcceptedDisclaimer: false,
  latestSyncTime: 0,
  isSyncEnabled: false,
  syncInterval: DEFAULT_SYNC_FREQUENCY_SECONDS,
  sectionHeading: DEFAULT_SECTION_HEADING,
  tagPrefix: DEFAULT_TAG_PREFIX,
  recentCount: DEFAULT_RECENT_COUNT
});

export class PinboardSyncSettingsTab extends PluginSettingTab {
	private plugin: DailyPinboardPlugIn;

	constructor(app: App, plugin: DailyPinboardPlugIn) {
		super(app, plugin);
		this.plugin = plugin;
	}

  display(): void {
    this.containerEl.empty();
    this.containerEl.createEl("h3", {
    	text: "Pinboard",
    });
    this.addApiTokenSetting();

    this.containerEl.createEl("h3", {
      text: "Format",
    });
    this.addSectionHeadingSetting();
    this.addTagPrefixSetting();

    this.containerEl.createEl("h3", {
      text: "Sync",
    });
    this.addSyncEnabledSetting();
    this.addSyncIntervalSetting();
    this.addRecentCountSetting();
  }

  addApiTokenSetting(): void {
  	new Setting(this.containerEl)
  	  .setName("Token")
  	  .setDesc(
  	  	"Pinboard API Token"
  	  )
  	  .addText((textfield) => {
  	  	textfield.setValue(this.plugin.options.apiToken);
  	  	textfield.onChange(async (rawApiToken) => {
  	  		const apiToken = rawApiToken.trim();
  	  		this.plugin.writeOptions({ apiToken });
  	  	});
  	  });
  }

    addRecentCountSetting(): void {
    new Setting(this.containerEl)
      .setName("Recent Posts")
      .setDesc("Number of recent posts the plugin will read to sync")
      .addText((textfield) => {
        textfield.setValue(String(this.plugin.options.recentCount));
        textfield.inputEl.type = "number";
        textfield.inputEl.onblur = (e: FocusEvent) => {
          const recentCount = Number((<HTMLInputElement>e.target).value);
          textfield.setValue(String(recentCount));
          this.plugin.writeOptions({ recentCount });
        };
      });
  }


  addSectionHeadingSetting(): void {
    new Setting(this.containerEl)
      .setName("Section heading")
      .setDesc(
        "Markdown heading to use when adding the Pinboard links to a daily note"
      )
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.sectionHeading);
        textfield.onChange(async (rawSectionHeading) => {
          const sectionHeading = rawSectionHeading.trim();
          this.plugin.writeOptions({ sectionHeading });
        });
      });
  }

  addSyncEnabledSetting(): void {
    new Setting(this.containerEl)
      .setName("Enable periodic syncing")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.isSyncEnabled);
        toggle.onChange(async (isSyncEnabled) => {
          this.plugin.writeOptions({ isSyncEnabled });
        });
      });
  }

  addSyncIntervalSetting(): void {
    new Setting(this.containerEl)
      .setName("Sync Frequency")
      .setDesc("Number of seconds the plugin will wait before syncing again")
      .addText((textfield) => {
        textfield.setValue(String(this.plugin.options.syncInterval));
        textfield.inputEl.type = "number";
        textfield.inputEl.onblur = (e: FocusEvent) => {
          const syncInterval = Number((<HTMLInputElement>e.target).value);
          textfield.setValue(String(syncInterval));
          this.plugin.writeOptions({ syncInterval });
        };
      });
  }

  addTagPrefixSetting(): void {
    new Setting(this.containerEl)
      .setName("Tag Prefix")
      .setDesc(
        "Prefix added to Pinboard tags when imported into Obsidian (e.g. #pinboard/work)"
      )
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.tagPrefix);
        textfield.onChange(async (tagPrefix) => {
          this.plugin.writeOptions({ tagPrefix });
        });
      });
  }

}

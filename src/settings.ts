import { App, PluginSettingTab, Setting } from "obsidian";

import type PinboardSyncPlugIn from "./main";
import { PinboardPost } from "./pbsdk";

export const DEFAULT_SECTION_HEADING = "## Pinboard";
export const DEFAULT_SYNC_FREQUENCY_SECONDS = 30 * 60; // Every 30 minutes
export const DEFAULT_TAG_PREFIX = "pinboard/";
export const DEFAULT_PIN_TOKEN = "Username:SecretTokenCode"
export const DEFAULT_RECENT_COUNT = 20;
export const DEFAULT_ONE_NOTE_PER_PIN_PATH = 'pinboard/';
export const DEFAULT_ONE_NOTE_PER_PIN_TAG = 'pinboard';
export const DEFAULT_ONE_NOTE_PER_PIN_TITLE_FORMAT = 'YYYY-MM/[{description}]'

export const pinFormattingFields: (keyof PinboardPost)[] = [
  'description',
  'href',
  'extended',
  'shared',
  'toread',
  'tags'
]

export interface ISettings {
  apiToken: string;
  hasAcceptedDisclaimer: boolean;
  latestSyncTime: number;

  isSyncEnabled: boolean;
  dailyNotesEnabled: boolean;
  sectionHeading: string;
  syncInterval: number;
  tagPrefix: string;
  recentCount: number;
  oneNotePerPin: boolean;
  oneNotePerPinPath: string;
  oneNotePerPinTag: string;
  oneNotePerPinTitleFormat: string;
}

export const DEFAULT_SETTINGS = Object.freeze({
  apiToken: DEFAULT_PIN_TOKEN,
  hasAcceptedDisclaimer: false,
  latestSyncTime: 0,
  isSyncEnabled: false,
  syncInterval: DEFAULT_SYNC_FREQUENCY_SECONDS,
  dailyNotesEnabled: true,
  sectionHeading: DEFAULT_SECTION_HEADING,
  tagPrefix: DEFAULT_TAG_PREFIX,
  recentCount: DEFAULT_RECENT_COUNT,
  oneNotePerPin: false,
  oneNotePerPinPath: DEFAULT_ONE_NOTE_PER_PIN_PATH,
  oneNotePerPinTag: DEFAULT_ONE_NOTE_PER_PIN_TAG,
  oneNotePerPinTitleFormat: DEFAULT_ONE_NOTE_PER_PIN_TITLE_FORMAT
});

export class PinboardSyncSettingsTab extends PluginSettingTab {
	private plugin: PinboardSyncPlugIn;

	constructor(app: App, plugin: PinboardSyncPlugIn) {
		super(app, plugin);
		this.plugin = plugin;
	}

  display(): void {
    this.containerEl.empty();
    this.containerEl.createEl("h3", {
    	text: "Pinboard",
    });
    this.addApiTokenSetting();

    this.containerEl.createEl("h4", {
    	text: "General",
    });
    this.addTagPrefixSetting();

    this.containerEl.createEl("h4", {
      text: "Daily notes",
    });
    this.addDailyNotesSetting();
    this.addSectionHeadingSetting();

    this.containerEl.createEl("h4", {
      text: "Sync",
    });
    this.addSyncEnabledSetting();
    this.addSyncIntervalSetting();
    this.addRecentCountSetting();

    this.containerEl.createEl("h4", {
    	text: "One note per pin",
    });
    this.addOneNotePerPinSetting();
    this.addOneNotePerPinPathSetting();
    this.addOneNotePerPinTagSetting();
    this.addOneNotePerPinTitleFormatSetting();
  }

  addApiTokenSetting(): void {
  	new Setting(this.containerEl)
  	  .setName("Token")
  	  .setDesc(
  	  	"Pinboard API Token"
  	  )
  	  .addText((textfield) => {
  	  	textfield.setValue(this.plugin.settings.apiToken);
  	  	textfield.onChange(async (rawApiToken) => {
  	  		const apiToken = rawApiToken.trim();
  	  		this.plugin.writeSettings({ apiToken });
  	  	});
  	  });
  }

  addOneNotePerPinSetting(): void {
  	new Setting(this.containerEl)
  	  .setName("Enable one note per pin mode")
  	  .setDesc(
  	  	"When enabled, syncing will create a new note per pin"
  	  )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.oneNotePerPin);
        toggle.onChange(oneNotePerPin => {
          this.plugin.writeSettings({ oneNotePerPin });
        });
      })
  }

  addOneNotePerPinPathSetting(): void {
  	new Setting(this.containerEl)
  	  .setName("One note per pin path")
  	  .setDesc(
  	  	"The path to store pins in when using the one note per pin setting"
  	  )
      .addText((textfield) => {
        textfield.setValue(this.plugin.settings.oneNotePerPinPath);
        textfield.inputEl.onblur = (e: FocusEvent) => {
          const oneNotePerPinPath = (<HTMLInputElement>e.target).value;
          textfield.setValue(oneNotePerPinPath);
          this.plugin.writeSettings({ oneNotePerPinPath });
        };
      })
  }

  addOneNotePerPinTagSetting(): void {
  	new Setting(this.containerEl)
  	  .setName("One note per pin tag")
  	  .setDesc(
  	  	"An optional tag to add to all notes created to match pinboard pins"
  	  )
      .addText((textfield) => {
        textfield.setValue(this.plugin.settings.oneNotePerPinTag);
        textfield.inputEl.onblur = (e: FocusEvent) => {
          const oneNotePerPinTag = (<HTMLInputElement>e.target).value;
          textfield.setValue(oneNotePerPinTag);
          this.plugin.writeSettings({ oneNotePerPinTag });
        };
      })
  }

  addOneNotePerPinTitleFormatSetting(): void {
  	new Setting(this.containerEl)
  	  .setName("One note per pin title format")
  	  .setDesc(
  	  	`The format to use when saving pins into the folder. Uses moment format, [{description}] is replaced with the pin description. Supports ${pinFormattingFields.map(field => `[{${field}}]`).join(',')} fields of pins`
  	  )
      .addText((textfield) => {
        textfield.setValue(this.plugin.settings.oneNotePerPinTitleFormat);
        textfield.inputEl.onblur = (e: FocusEvent) => {
          const oneNotePerPinTitleFormat = (<HTMLInputElement>e.target).value;
          textfield.setValue(oneNotePerPinTitleFormat);
          this.plugin.writeSettings({ oneNotePerPinTitleFormat });
        };
      })
  }

    addRecentCountSetting(): void {
    new Setting(this.containerEl)
      .setName("Recent Posts")
      .setDesc("Number of recent posts the plugin will read to sync")
      .addText((textfield) => {
        textfield.setValue(String(this.plugin.settings.recentCount));
        textfield.inputEl.type = "number";
        textfield.inputEl.onblur = (e: FocusEvent) => {
          const recentCount = Number((<HTMLInputElement>e.target).value);
          textfield.setValue(String(recentCount));
          this.plugin.writeSettings({ recentCount });
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
        textfield.setValue(this.plugin.settings.sectionHeading);
        textfield.onChange(async (rawSectionHeading) => {
          const sectionHeading = rawSectionHeading.trim();
          this.plugin.writeSettings({ sectionHeading });
        });
      });
  }

  addDailyNotesSetting(): void {
    new Setting(this.containerEl)
      .setName("Enable adding pins to daily notes")
      .setDesc(
        "When enabled, pins will be synced to the day's daily note"
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.dailyNotesEnabled);
        toggle.onChange(dailyNotesEnabled => {
          this.plugin.writeSettings({ dailyNotesEnabled });
        });
      })
  }

  addSyncEnabledSetting(): void {
    new Setting(this.containerEl)
      .setName("Enable periodic syncing")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.isSyncEnabled);
        toggle.onChange(async (isSyncEnabled) => {
          this.plugin.writeSettings({ isSyncEnabled });
        });
      });
  }

  addSyncIntervalSetting(): void {
    new Setting(this.containerEl)
      .setName("Sync Frequency")
      .setDesc("Number of seconds the plugin will wait before syncing again")
      .addText((textfield) => {
        textfield.setValue(String(this.plugin.settings.syncInterval));
        textfield.inputEl.type = "number";
        textfield.inputEl.onblur = (e: FocusEvent) => {
          const syncInterval = Number((<HTMLInputElement>e.target).value);
          textfield.setValue(String(syncInterval));
          this.plugin.writeSettings({ syncInterval });
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
        textfield.setValue(this.plugin.settings.tagPrefix);
        textfield.onChange(async (tagPrefix) => {
          this.plugin.writeSettings({ tagPrefix });
        });
      });
  }

}

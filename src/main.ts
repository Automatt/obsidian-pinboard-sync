import type moment from "moment";

import { Notice, Plugin } from "obsidian";
import {
  createDailyNote,
  getDailyNote,
  getAllDailyNotes,
} from "obsidian-daily-notes-interface";

import { ConfirmationModal } from "./modal";

import {
  DEFAULT_SETTINGS,
  ISettings,
  PinboardSyncSettingsTab,
} from "./settings";

import { Pinboard } from "./pbsdk";
import { PinRenderer } from "./renderer";

import { groupBy, isMacOS, updateSection } from "./textUtils";


declare global {
  interface Window {
    moment: typeof moment;
  }
}

export default class PinboardSyncPlugin extends Plugin {

  public options: ISettings;
  private syncTimeoutId: number;
  private settingsTab: DailyPinboardSettingsTab;

  async onload(): Promize<void> {

    console.log("[Pinboard] loading plugin");

    this.scheduleNextSync = this.scheduleNextSync.bind(this);
    this.syncPinboard = this.syncPinboard.bind(this);
    this.tryToScheduleSync = this.tryToScheduleSync.bind(this);
    this.tryToSyncPinboard = this.tryToSyncPinboard.bind(this);


    this.addCommand({
      id: "pinboard-sync-cmd",
      name: "Sync",
      callback: () => setTimeout(this.tryToSyncPinboard, 20),
    });

    await this.loadOptions();

    this.settingsTab = new PinboardSyncSettingsTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    if (this.options.hasAcceptedDisclaimer && this.options.isSyncEnabled) {
      if (this.app.workspace.layoutReady) {
        this.scheduleNextSync();
      } else {
        this.registerEvent(
          this.app.workspace.on("layout-ready", this.scheduleNextSync)
        );
      }
    }
  }

  onunload() {
    console.log("[Pinboard] unloading plugin");
  }

  async tryToSyncPinboard(): Promise<void> {
    if (this.options.hasAcceptedDisclaimer) {
      this.syncPinboard();
    } else {
      new ConfirmationModal(this.app, {
        cta: "Sync",
        onAccept: async () => {
          await this.writeOptions({ hasAcceptedDisclaimer: true });
          this.syncPinboard();
        },
        text:
          "Enabling sync will backfill your recent Pinboard into Obsidian. This means potentially creating or modifying hundreds of notes. Make sure to test the plugin in a test vault before continuing.",
        title: "Sync Now?",
      }).open();
    }
  }

  async tryToScheduleSync(): Promise<void> {
    if (this.options.hasAcceptedDisclaimer) {
      this.scheduleNextSync();
    } else {
      new ConfirmationModal(this.app, {
        cta: "Sync",
        onAccept: async () => {
          await this.writeOptions({ hasAcceptedDisclaimer: true });
          this.scheduleNextSync();
        },
        onCancel: async () => {
          await this.writeOptions({ isSyncEnabled: false });
          // update the settings tab display
          this.settingsTab.display();
        },
        text:
          "Enabling sync will backfill your recent Pinboard into Obsidian. This means potentially creating or modifying hundreds of notes. Make sure to test the plugin in a test vault before continuing.",
        title: "Sync Now?",
      }).open();
    }
  }

  async getPostsFromPinboard (
    latestSyncTime: number,
    options: ISettings
    ):Promise<PinboardPostCollection> {

      let pinboard = new Pinboard(options.apiToken);
      let handleApiFailure = (error: any) => {
        console.log(`API error: ${error}`);
      };

      return pinboard.posts.recent([], options.recentCount);
    }


  async syncPinboard(): Promise<void> {
    const pinRenderer = new PinRenderer(this.app, this.options);
    const dailyNotes = getAllDailyNotes();
    const latestSyncTime = this.options.latestSyncTime || 0;

    let pinCollection = [];
    try {
      pinCollection = await this.getPostsFromPinboard(latestSyncTime, this.options);
    } catch (err) {
      new Notice("[Pinboard Sync] failed");
      console.log(err);
      return;
    }

    const daysToPins: Record<string, PinboardPost> = groupBy(
      pinCollection.posts.filter((pin) => pin.time),
      (pin) => window.moment(pin.time).startOf("day").format()
    );

    for (const [dateStr, pins] of Object.entries(daysToPins)) {
      const date = window.moment(dateStr);

      let dailyNote = getDailyNote(date, dailyNotes);

      if (!dailyNote) {
        dailyNote = await createDailyNote(date);
      }

      await updateSection(
        this.app,
        dailyNote,
        this.options.sectionHeading,
        pinRenderer.render(pins)
      );
    }

    new Notice("[Pinboard Sync] complete");
    this.writeOptions({ latestSyncTime: window.moment().unix() });
    this.scheduleNextSync();
  }

  cancelScheduledSync(): void {
    if (this.syncTimeoutId !== undefined) {
      window.clearTimeout(this.syncTimeoutId);
    }
  }

  scheduleNextSync(): void {
    const now = window.moment().unix();

    this.cancelScheduledSync();
    if (!this.options.isSyncEnabled || !this.options.syncInterval) {
      console.log("[Pinboard] scheduling skipped, no syncInterval set");
      return;
    }

    const { latestSyncTime, syncInterval } = this.options;
    const syncIntervalMs = syncInterval * 1000;
    const nextSync = Math.max(latestSyncTime + syncIntervalMs - now, 20);

    console.log(`[Pinboard] next sync scheduled in ${nextSync}ms`);
    this.syncTimeoutId = window.setTimeout(this.syncPinboard, nextSync);
  }


  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async loadOptions(): Promise<void> {
    this.options = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.options.hasAcceptedDisclaimer) {
      // In case the user quits before accepting sync modal,
      // this will keep the settings in sync
      this.options.isSyncEnabled = false;
    }
  }

  async writeOptions(diff: Partial<ISettings>): Promise<void> {
    this.options = Object.assign(this.options, diff);

    // Sync toggled on/off
    if (diff.isSyncEnabled !== undefined) {
      if (diff.isSyncEnabled) {
        this.tryToScheduleSync();
      } else {
        this.cancelScheduledSync();
      }
    } else if (diff.syncInterval !== undefined && this.options.isSyncEnabled) {
      // reschedule if interval changed
      this.tryToScheduleSync();
    }

    await this.saveData(this.options);
  }

}

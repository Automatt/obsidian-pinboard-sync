import type moment from "obsidian";

import { normalizePath, Notice, Plugin } from "obsidian";
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

import { Pinboard, PinboardPost, PinboardPostCollection } from "./pbsdk";
import { PinRenderer } from "./renderer";

import { groupBy, updateProperties, updateSection } from "./textUtils";
import { getOrCreateNoteForPin } from "./fileUtils";


declare global {
  interface Window {
    moment: typeof moment;
  }
}

export default class PinboardSyncPlugin extends Plugin {

  public settings: ISettings;
  private syncTimeoutId: number;
  private settingsTab: PinboardSyncSettingsTab;

  async onload(): Promise<void> {

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

    await this.loadSettings();

    this.settingsTab = new PinboardSyncSettingsTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));
  }

  onunload() {
    console.log("[Pinboard] unloading plugin");
  }

  async onLayoutReady(): Promise<void> {
    if (this.settings.hasAcceptedDisclaimer && this.settings.isSyncEnabled) {
      this.scheduleNextSync();
    }
  }

  async tryToSyncPinboard(): Promise<void> {
    if (this.settings.hasAcceptedDisclaimer) {
      this.syncPinboard();
    } else {
      new ConfirmationModal(this.app, {
        cta: "Sync",
        onAccept: async () => {
          await this.writeSettings({ hasAcceptedDisclaimer: true });
          this.syncPinboard();
        },
        text:
          "Enabling sync will backfill your recent Pinboard into Obsidian. This means potentially creating or modifying hundreds of notes. Make sure to test the plugin in a test vault before continuing.",
        title: "Sync Now?",
      }).open();
    }
  }

  async tryToScheduleSync(): Promise<void> {
    if (this.settings.hasAcceptedDisclaimer) {
      this.scheduleNextSync();
    } else {
      new ConfirmationModal(this.app, {
        cta: "Sync",
        onAccept: async () => {
          await this.writeSettings({ hasAcceptedDisclaimer: true });
          this.scheduleNextSync();
        },
        onCancel: async () => {
          await this.writeSettings({ isSyncEnabled: false });
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

      return pinboard.posts.recent([], options.recentCount);
    }


  async syncPinboard(): Promise<void> {
    const pinRenderer = new PinRenderer(this.app, this.settings);
    const dailyNotes = getAllDailyNotes();
    const latestSyncTime = this.settings.latestSyncTime || 0;

    let pinCollection: PinboardPostCollection;
    try {
      pinCollection = await this.getPostsFromPinboard(latestSyncTime, this.settings);
    } catch (err) {
      new Notice("[Pinboard Sync] failed");
      console.log(err);
      return;
    }

    if (this.settings.oneNotePerPin) {
      const pinBasePath = normalizePath(this.settings.oneNotePerPinPath);
      await Promise.all(pinCollection.posts.map(async pin => {
        const file = await getOrCreateNoteForPin(this.app, pin, pinBasePath, this.settings.oneNotePerPinTitleFormat);

        return updateProperties(
          this.app,
          file,
          pinRenderer.renderPinProperties(pin)
        );
      }));
    }
    
    if (this.settings.dailyNotesEnabled) {
      const daysToPins: Record<string, PinboardPost[]> = groupBy(
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
          this.settings.sectionHeading,
          pinRenderer.render(pins)
        );
      }
    }

    new Notice("[Pinboard Sync] complete");
    this.writeSettings({ latestSyncTime: window.moment().unix() });
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
    if (!this.settings.isSyncEnabled || !this.settings.syncInterval) {
      console.log("[Pinboard] scheduling skipped, no syncInterval set");
      return;
    }

    const { latestSyncTime, syncInterval } = this.settings;
    const syncIntervalMs = syncInterval * 1000;
    const nextSync = Math.max(latestSyncTime + syncIntervalMs - now, 20);

    console.log(`[Pinboard] next sync scheduled in ${nextSync}ms`);
    this.syncTimeoutId = window.setTimeout(this.syncPinboard, nextSync);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.hasAcceptedDisclaimer) {
      // In case the user quits before accepting sync modal
      this.settings.isSyncEnabled = false;
    }
  }


  async writeSettings(diff: Partial<ISettings>): Promise<void> {
    this.settings = Object.assign(this.settings, diff);

    // Sync toggled on/off
    if (diff.isSyncEnabled !== undefined) {
      if (diff.isSyncEnabled) {
        this.tryToScheduleSync();
      } else {
        this.cancelScheduledSync();
      }
    } else if (diff.syncInterval !== undefined && this.settings.isSyncEnabled) {
      // reschedule if interval changed
      this.tryToScheduleSync();
    }

    await this.saveData(this.settings);
  }

}

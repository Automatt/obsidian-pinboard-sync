import { Editor } from "codemirror";
import moment from "moment";
import { App, MarkdownView, TFile, normalizePath, Notice, TFolder } from "obsidian";
import { PinboardPost } from "./pbsdk";

export function getEditorForFile(app: App, file: TFile): Editor | null {
  let editor = null;
  app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view instanceof MarkdownView && leaf.view.file === file) {
      editor = leaf.view.sourceMode.cmEditor;
    }
  });
  return editor;
}

function formatAsFilename(str: string) {
  // Remove any characters that are not letters, numbers, dots, hyphens, and underscores
  let validStr = str.replace(/[^a-zA-Z0-9\s\.\-_]/g, '');

  
  // Remove leading and trailing spaces
  validStr = validStr.trim();

  // Ensure the filename is not too long
  const MAX_LENGTH = 50;
  validStr = validStr.substring(0, MAX_LENGTH);

  return validStr;
}

function getPinPath(pin: PinboardPost, basePath: string, format: string) {
  const formattedFileName = moment(pin.time).format(format).replace('{description}', formatAsFilename(pin.description))
  return normalizePath(`${basePath}/${formattedFileName}.md`);
}

/**
 * a utility to make sure that all folders exist, if not, they will get created as an empty file
 * @param path eg. path/to/file.md
 */
async function touchFileAtPath(app: App, path: string) {
  const { vault } = app;
  const pathParts = path.split('/');
  const currentPath = [];
  if (pathParts.length === 0) {
    return;
  }
  // Create the folders
  while (pathParts.length > 1) {
    const part = pathParts.shift();
    currentPath.push(part);
    const currentFolderPath = currentPath.join('/');
    const folder = vault.getAbstractFileByPath(currentFolderPath);

    if (!folder || !(folder instanceof TFolder)) {
      await vault.createFolder(currentFolderPath)
    }
  }

  // All necessary folders exist. Create the file at the end
  const file = vault.getAbstractFileByPath(path);

  if (!file || !(file instanceof TFile)) {
    return await vault.create(path, '');
  }

  return file;
}

export async function getOrCreateNoteForPin(app: App, pin: PinboardPost, path: string, format: string): Promise<TFile | undefined> {
  const { vault } = app;

  const pinPath = getPinPath(pin, path, format);

  return touchFileAtPath(app, pinPath);
}
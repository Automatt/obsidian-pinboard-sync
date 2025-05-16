import { Editor } from "codemirror";
import moment from "moment";
import { App, MarkdownView, TFile, normalizePath, Notice, TFolder } from "obsidian";
import { PinboardPost, PinboardTag } from "./pbsdk";
import { pinFormattingFields } from "./settings";

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
  // Remove any characters that aren't in this explicit list, to ensure safety for file paths
  let validStr = str.replace(/[^a-zA-Z0-9\s\.\-_]/g, '');

  // Remove leading and trailing spaces
  validStr = validStr.trim();

  // Ensure the filename is not too long
  const MAX_LENGTH = 150;
  validStr = validStr.substring(0, MAX_LENGTH);

  return validStr;
}


function getPinPath(pin: PinboardPost, basePath: string, format: string) {
  // We support the format [{description}], which are fields on the PinboardPost object.
  // We wrap in square brackets to escape moment, and curly braces act as our template signifier.
  // (ie, moment.format will leave just {description}, which we can then replace ourselves)
  const dateFormattedFileName = moment(pin.time).format(format);
  let formattedFileName = dateFormattedFileName;

  for (let key of pinFormattingFields) {
    let value = pin[key];
    // Special handling for the tags field, which is pretty structured: extract the names and join them with commas,
    // eg. {tags} --> `pinboard/reference, pinboard/later`
    if (key === 'tags') {
      value = (value as PinboardTag[]).map(tag => tag.name).join(',')
    }

    formattedFileName = formattedFileName.replace(new RegExp(`{${key}}`, 'g'), formatAsFilename(String(value)));
  }
  return normalizePath(`${basePath}/${formattedFileName}.md`);
}

/**
 * A utility to make sure that all folders exist, if not, they will get created as an empty file
 * @param app
 * @param path eg. path/to/file.md
 */
async function touchFileAtPath(app: App, path: string) {
  const { vault } = app;
  const pathParts = path.split('/');
  const currentPath = [];

  if (pathParts.length === 0) {
    return;
  }
  
  // Create all necessary folders
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
  const pinPath = getPinPath(pin, path, format);
  return touchFileAtPath(app, pinPath);
}

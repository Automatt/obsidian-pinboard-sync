import type { App, TFile } from "obsidian";
import { getEditorForFile } from "./fileUtils";

export function getHeadingLevel(line = ""): number | null {
  const heading = line.match(/^(#{1,6})\s+\S/);
  return heading ? heading[1].length : null;
}

export function toHeading(title: string, level: number): string {
  const hash = "".padStart(level, "#");
  return `${hash} ${title}`;
}

export function getTab(useTab: boolean, tabSize: number): string {
  if (useTab) {
    return "\t";
  }
  return "".padStart(tabSize, " ");
}

export function groupBy<T>(
  arr: T[],
  predicate: (item: T) => string | number
): Record<string | number, T[]> {
  return arr.reduce((acc, elem) => {
    const val = predicate(elem);
    acc[val] = acc[val] || [];
    acc[val].push(elem);
    return acc;
  }, {} as Record<string | number, T[]>);
}

export async function updateSection(
  app: App,
  file: TFile,
  heading: string,
  sectionContents: string
): Promise<void> {
  const headingLevel = getHeadingLevel(heading);

  const { vault } = app;
  const fileContents = await vault.read(file);
  const fileLines = fileContents.split("\n");

  let logbookSectionLineNum = -1;
  let nextSectionLineNum = -1;

  for (let i = 0; i < fileLines.length; i++) {
    if (fileLines[i].trim() === heading) {
      logbookSectionLineNum = i;
    } else if (logbookSectionLineNum !== -1) {
      const currLevel = getHeadingLevel(fileLines[i]);
      if (currLevel && currLevel <= headingLevel) {
        nextSectionLineNum = i;
        break;
      }
    }
  }

  const editor = getEditorForFile(app, file);
  if (editor) {
    // if the "## Pinboard" header exists, we just replace the
    // section. If it doesn't, we need to append it to the end
    // if the file and add `\n` for separation.
    if (logbookSectionLineNum !== -1) {
      const from = { line: logbookSectionLineNum, ch: 0 };
      const to =
        nextSectionLineNum !== -1
          ? { line: nextSectionLineNum - 1, ch: 0 }
          : { line: fileLines.length, ch: 0 };

        editor.replaceRange(`${sectionContents}\n`, from, to);
      return;
    } else {
      const pos = { line: fileLines.length - 1, ch: 0 };
      editor.replaceRange(`\n\n${sectionContents}`, pos, pos);
      return;
    }
  }

  // Editor is not open, modify the file on disk...
  if (logbookSectionLineNum !== -1) {
    // Section already exists, just replace
    const prefix = fileLines.slice(0, logbookSectionLineNum);
    const suffix =
      nextSectionLineNum !== -1 ? fileLines.slice(nextSectionLineNum) : [];

    return vault.modify(
      file,
      [...prefix, sectionContents, ...suffix].join("\n")
    );
  } else {
    // Section does not exist, append to end of file.
    return vault.modify(file, [...fileLines, "", sectionContents].join("\n"));
  }
}

/**
 * Replaces the properties block at the start of a file with this new one, or adds a new properties block if that does not exist
 * @param app 
 * @param file the file to add to
 * @param properties a string representing the properties to add
 * @example
 * const properties = dedent`---
 *   tags: work
 *   time: 2023-12-01
 *   ---`;
 * updateProperties(app, file, properties);
 */
export async function updateProperties(
  app: App,
  file: TFile,
  properties: string
): Promise<void> {
  const { vault } = app;
  const fileContents = await vault.read(file);
  let fileLines = fileContents.split("\n");
  const propertiesLines: number[] = [];
  
  // Collect all of the properties marker lines
  for (let i = 0; i < fileLines.length; i++) {
    if (fileLines[i] === '---') {
      propertiesLines.push(i);
    }
  }

  // If we found correct matching markers, remove the existing properties so we can update them
  if (propertiesLines[0] === 0 && propertiesLines[1] > 0) {
    const propertiesEndLine = propertiesLines[1];
    fileLines = fileLines.slice(propertiesEndLine + 1)
  }

  // Don't worry about the case where the editor is open here.
  // It's more unlikely that the user is editing the existing note
  return vault.modify(
    file,
    [properties, ...fileLines].join('\n')
  );
}

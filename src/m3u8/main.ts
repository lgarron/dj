#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { exit } from "node:process";
import { $, file, fileURLToPath } from "bun";
import { stringToSHA256Hex } from "./sha256";

const AUTHOR = "Lucas Garron";
const SONGS_FOLDER_NAME = "Songs";

const cloudPathRoot = await (async () => {
  // TODO: find an XDG path lib worth using.
  const configFile = file(join(homedir(), ".config/dj/config.json"));
  if (!(await configFile.exists())) {
    console.error("No config file found. Skipping cloud export.");
    return undefined;
  }

  const config: { cloudPathRoot: string } = await configFile.json();
  return config.cloudPathRoot;
})();

interface PlaylistInfo {
  name: string;
  description: string;
  tracks: Track[];
}

// Note: for most fields, a missing value is not distinguished from an empty string.
interface Track {
  name: string;
  duration: number; // seconds
  bpm: number;
  grouping: string;
  artist: string;
  album: string;
  cloudStatus: "downloaded" | "purchased" | "matched" | "subscription";
  location: string | null;
}

// Optional JSON to be placed in the final non-blank line of a playlist description.
interface PlaylistDescriptionJSONMetadata {
  "dj-backup-nonce"?: string;
}

const {
  name: playlistName,
  description,
  tracks,
}: PlaylistInfo = await $`osascript ${fileURLToPath(
  new URL(import.meta.resolve("./current-playlist.jxa.js")),
)}`.json();

const playlistDescriptionJSONMetadata: PlaylistDescriptionJSONMetadata | null =
  (() => {
    try {
      // biome-ignore lint/style/noNonNullAssertion: #yolo
      return JSON.parse(description.trim().split("\n").at(-1)!);
    } catch {
      return null;
    }
  })();

let nonce = (await stringToSHA256Hex(playlistName)).slice(0, 16);
if (playlistDescriptionJSONMetadata) {
  if (playlistDescriptionJSONMetadata["dj-backup-nonce"]) {
    nonce = playlistDescriptionJSONMetadata["dj-backup-nonce"];
    console.log(`Using nonce from playlist description: ${nonce}`);
  }
}

// @ts-ignore
const [_, date, year, occasion] = playlistName.match(
  /^((\d{4})-\d{2}-\d{2}) — (.*)$/,
);

const cloudFolder = `${date}-${occasion
  .replaceAll(/[ \(\)]+/g, " ")
  .trim()
  .replaceAll(" ", "-")}-${nonce}`;

const goodCloudStatuses = new Set(["uploaded", "purchased", "matched"]);

const outputFolder = join(".", cloudFolder);
if (existsSync(outputFolder)) {
  console.error(`Output folder already exists: ${outputFolder}`);
  exit(1);
}

function appendComponentToURLPath(url: string, newComponent: string): string {
  const parsedURL = new URL(url);
  // Can't safely use `join(…)` on a URL. (it mangles `https://` into `https:/`)
  parsedURL.pathname = join(parsedURL.pathname, newComponent);
  return parsedURL.toString();
}

const songFolder = join(outputFolder, SONGS_FOLDER_NAME);

const songFolderRelativeM3U8Path = join(".", SONGS_FOLDER_NAME);

const relativeM3U8Lines = [
  "#EXTM3U",
  `#PLAYLIST:${playlistName}`,
  // "#EXTGRP:Set 1" // etc.
];
const cloudM3U8Lines = structuredClone(relativeM3U8Lines);

let trackNumber = 0;
for (const track of tracks) {
  trackNumber++;
  if (!goodCloudStatuses.has(track.cloudStatus)) {
    throw new Error(
      `Track #${trackNumber} (${track.name}) is has an unsupported cloud status: ${track.cloudStatus}`,
    );
  }

  if (!track.location) {
    throw new Error(
      `Track #${trackNumber} (${track.name}) is missing location.`,
    );
  }

  const fileName = basename(track.location);
  cp(track.location, join(songFolder, fileName));

  // TODO: throw / sanitize on newlines or other injection faults?
  const metadataLine = `#EXTINF:${Math.round(track.duration)},${track.artist} - ${track.name}`;

  relativeM3U8Lines.push(metadataLine);
  relativeM3U8Lines.push(join(songFolderRelativeM3U8Path, fileName));

  if (cloudPathRoot) {
    const cloudPath = `${cloudPathRoot}/${year}/${cloudFolder}/`;
    const songFolderCloudM3U8Path = appendComponentToURLPath(
      cloudPath,
      SONGS_FOLDER_NAME,
    );
    cloudM3U8Lines.push(metadataLine);
    cloudM3U8Lines.push(
      appendComponentToURLPath(songFolderCloudM3U8Path, fileName),
    );
  }
}

await mkdir(outputFolder, { recursive: true });

const coreFileName = `${AUTHOR} — ${playlistName}`;
const relativeM3U8FileName = `${coreFileName}.m3u8`;
const cloudM3U8FileName = `${coreFileName} (cloud playlist).m3u8`;
file(join(outputFolder, relativeM3U8FileName))
  .writer()
  .write(relativeM3U8Lines.join("\n"));

if (cloudPathRoot) {
  file(join(outputFolder, cloudM3U8FileName))
    .writer()
    .write(cloudM3U8Lines.join("\n"));
}

await $`open ${outputFolder}`;
await $`cd ${outputFolder} && zip -r ${coreFileName} ${relativeM3U8FileName} ${SONGS_FOLDER_NAME}`;

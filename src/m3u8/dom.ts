import { html_beautify } from "js-beautify";
import { JSDOM } from "jsdom";

const dom = new JSDOM();
const { document } = dom.window;
const table = document.body.appendChild(document.createElement("table"));
const thead = table.appendChild(document.createElement("thead"));
{
  const tr = thead.appendChild(document.createElement("tr"));
  tr.appendChild(document.createElement("th")).textContent = "Song";
  tr.appendChild(document.createElement("th")).textContent = "Duration";
  tr.appendChild(document.createElement("th")).textContent = "BPM";
  tr.appendChild(document.createElement("th")).textContent = "Type";
  tr.appendChild(document.createElement("th")).textContent = "Artist";
}
const tbody = table.appendChild(document.createElement("tbody"));

function extractName(s: string): string {
  const match = s.match(/^«([^»]+)»$/);
  if (match) {
    return match[1].trim();
  }
  return s.split("«")[0].split("(")[0].split("[")[0].trim();
}

function extractSongType(s: string): string {
  {
    const match = s.match(/^\(([^\)]+)\)/);
    if (match) {
      return match[1].trim();
    }
  }
  {
    const match = s.match(/^\[([^\]]+)\]/);
    if (match) {
      return match[1].trim();
    }
  }
  return s;
}

export function appendRow(
  data: {
    name: string;
    grouping: string;
    bpm: number;
    duration: number;
    artist: string;
  },
  fileName: string,
) {
  if (data.grouping.includes("set-list:skip")) {
    console.log(`Skipping: ${data.name}`);
    return;
  }

  const isMetadataTrack = data.name.startsWith("--------");
  if (isMetadataTrack) {
    const td = tbody
      .appendChild(document.createElement("tr"))
      .appendChild(document.createElement("td"));
    td.colSpan = 5;
    td.textContent = data.name;
    return;
  }

  const tr = tbody.appendChild(document.createElement("tr"));
  const a = tr
    .appendChild(document.createElement("td"))
    .appendChild(document.createElement("a"));
  a.textContent = extractName(data.name);
  a.href = `./Songs/${encodeURIComponent(fileName)}`;
  tr.appendChild(document.createElement("td")).textContent =
    data.bpm === 0 ? "" : data.bpm.toString();
  tr.appendChild(document.createElement("td")).textContent =
    `${Math.floor(data.duration / 60).toString()}:${Math.floor(
      data.duration % 60,
    )
      .toString()
      .padStart(2, "0")}`;
  tr.appendChild(document.createElement("td")).textContent = extractSongType(
    data.grouping,
  );
  tr.appendChild(document.createElement("td")).textContent = data.artist;
}

export function serialize(): string {
  return html_beautify(dom.serialize());
}

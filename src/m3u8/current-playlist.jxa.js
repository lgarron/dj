const music = Application("Music");

const { currentPlaylist } = music;
const name = currentPlaylist.name();
const description = currentPlaylist.description();
const tracks = currentPlaylist.tracks().map((track) => {
  const name = track.name();
  const duration = track.duration();
  const bpm = track.bpm();
  const grouping = track.grouping();
  const artist = track.artist();
  const album = track.album();
  const cloudStatus = track.cloudStatus();
  const location = (() => {
    try {
      return track.location().toString();
    } catch {
      return null;
    }
  })();

  return {
    name,
    duration,
    bpm,
    grouping,
    artist,
    album,
    cloudStatus,
    location,
  };
});

// The final statement of the script is printed to `stdout`.
// (Using `console.log(…)` directly seems to print to `stderr` instead, but only under some conditions?)
JSON.stringify({ name, description, tracks }, null, "  ");

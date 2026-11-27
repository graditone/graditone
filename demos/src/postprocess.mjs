/**
 * Post-processing, stage one: mux the video with the parallel audio track.
 *
 * The audio was recorded in the page (see audioCapture.mjs) and starts when the
 * app first built its audio graph, not when the video did, so we delay it by
 * the measured difference. After this the file is a normal video with sound and
 * can be handed to DemoClip.
 */

import { execFile } from 'node:child_process';
import path from 'node:path';

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { maxBuffer: 1 << 26, ...options },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`${command} failed:\n${stderr || error.message}`));
        else resolve({ stdout, stderr });
      },
    );
  });
}

export function ffmpeg(args) {
  return runCommand('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
}

/**
 * Where in the video the audio file's first sample belongs, in milliseconds.
 *
 * The audio's own t=0 is the first sound the tap carried (`firstSoundAt`), or —
 * if nothing was ever heard — when the recorder started. Both are wall-clock
 * marks taken in the page, on the same clock as the video's start mark.
 */
export function audioDelayMs(timeline, videoStartMs) {
  if (!timeline) return 0;
  const start = timeline.firstSoundAt || timeline.recorderStartAt || timeline.contextAt;
  if (!start) return 0;
  return Math.max(0, Math.round(start - videoStartMs));
}

/** Measure a track's EBU R128 loudness, for a proper (two-pass) normalisation. */
async function measureLoudness(audio) {
  const { stderr } = await runCommand('ffmpeg', [
    '-hide_banner',
    '-i', audio,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
    '-f', 'null', '-',
  ]);
  const json = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (!json) return null;
  const measured = JSON.parse(json[0]);
  // A silent or unmeasurable input reports -inf, which the linear pass refuses.
  if (!Number.isFinite(Number(measured.input_i))) return null;
  return measured;
}

/** Combine `video` and `audio` into `out`, shifting the audio by `delayMs`. */
export async function muxWithAudio({ video, audio, delayMs = 0 }, out) {
  if (!audio) {
    await ffmpeg(['-i', video, '-c', 'copy', out]);
    return { out, delayMs: 0, hasAudio: false };
  }

  // The app's own output is quiet (it plays scores at their written dynamic, often
  // pp), so we bring the track to a broadcast loudness the way any player would.
  // Two passes, so the gain is linear over the whole clip rather than pumped.
  const measured = await measureLoudness(audio).catch(() => null);
  const norm = measured
    ? 'loudnorm=I=-16:TP=-1.5:LRA=11:linear=true' +
      `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
      `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
      `:offset=${measured.target_offset}`
    : 'loudnorm=I=-16:TP=-1.5:LRA=11';

  const filter = `[1:a]adelay=${delayMs}|${delayMs},aresample=async=1,${norm}[a]`;
  await ffmpeg([
    '-i', video,
    '-i', audio,
    '-filter_complex', filter,
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy',
    '-c:a', 'libopus', '-b:a', '192k',
    out,
  ]);
  return { out, delayMs, hasAudio: true, normalised: Boolean(measured) };
}

export function defaultPaths(outDir, flowId) {
  const raw = path.join(outDir, 'raw', flowId);
  return {
    rawDir: raw,
    video: path.join(raw, `${flowId}.video.webm`),
    audio: path.join(raw, `${flowId}.audio.webm`),
    muxed: path.join(outDir, `${flowId}.webm`),
  };
}

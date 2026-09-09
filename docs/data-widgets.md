# Data widgets

How simple-bar's data widgets work: the shared refresh/caching contract every
widget follows, and the audio visualization pipeline, which has stricter timing
requirements than the rest.

Performance rules in this file were established by measuring this setup
(8 GB Mac, single display). Treat the numbers as machine-specific examples,
not universal constants.

## Data-widget anatomy

Every widget in `lib/components/data/` follows the same shape:

- `lib/components/data/<name>.jsx` — component: state, polling, server-socket hook
- `lib/styles/components/data/<name>.js` — exported `styles` string, injected by `index.jsx`
- `lib/scripts/<name>.sh` (optional) — shell commands executed via `Uebersicht.run`

Component contracts:

- `useWidgetRefresh(visible, getter, refresh)` (`lib/hooks/use-widget-refresh.js`)
  polls `getter` on a `setInterval` of `refresh` ms. `getter` must be stable
  (`React.useCallback`): its identity is in the effect's dependency list.
- `useServerSocket(target, visible, getter, ...)` additionally calls `getter` on
  server-pushed `refresh`/`push` messages from simple-bar-server. The server is a
  passive relay: it only pushes when an external HTTP caller asks
  (`~/.config/simple-bar-server`, port 7776).
- Polling is a fallback for the socket, not a race: both paths call the same
  `getter`, which reads through `cachedRun` and is effectively free within one
  refresh cycle.
- Rendering: `DataWidget.Widget` is the capsule shell, `DataWidgetLoader.Widget`
  is the loading placeholder, `Utils.cachedRun` and `Utils.cleanupOutput` handle
  command output.

## The `cachedRun` timing contract

`Utils.cachedRun(command, cacheTimeout)` (`lib/utils.js`) deduplicates command
execution across displays via `localStorage`, with `cacheTimeout` as the TTL.
The timestamp is captured *before* the run starts, so the effective TTL window
starts at spawn time, not at resolution time.

Two rules:

1. **TTL must be shorter than the poll interval.** With `TTL === interval`,
   clock drift makes roughly every other tick resolve as a cache hit. Each
   cached hit serves the previous run's output, halving the effective update
   rate. For widgets that need every tick to observe fresh data (like the
   audio viz), pass `refresh / 2`:

   ```js
   await Utils.cachedRun(cmd, refresh / 2); // audio-viz.jsx
   ```

2. **Command duration must be far below the interval.** If one command run
   takes longer than the interval, every tick spawns a fresh copy and the
   machine runs the command back-to-back, 100% of the time. Real case: the
   WiFi widget polls `system_profiler SPAirPortDataType` (≈5.6 s per run on
   this machine). At a 500 ms refresh that meant continuous scans saturating
   the Übersicht spawn pipeline and stalling every other widget, including the
   audio visualizer. Keep such slow commands on 20 s+ refreshes or replace
   them with fast equivalents.

## Audio visualization widget

`lib/components/data/audio-viz.jsx` renders a live spectrum as 24 bars using
[cava](https://github.com/karavias/cava). Pipeline:

```
cava (CoreAudio process tap, 15 fps, cava.conf)
  └─ stdout frames "v;v;…;v" (0–100, 24 bars)
      └─ frame-writer loop in cava-viz.sh rewrites one frame file (TMPDIR)
          └─ widget polls cava-viz.sh every `refresh` ms (default 200)
              └─ parse → setBars() → React re-render (24 <span>s)
                  └─ CSS transition on bar heights (80 ms)
```

### `lib/scripts/cava-viz.sh`

A persistent streamer owns cava so no CoreAudio tap is created per read:

- **Fast path** (~15–70 ms): `stat` the frame file; if it was written within
  the last 2 s, `cat` it. This proves the streamer is alive without spawning
  anything expensive.
- **Slow path** (streamer dead): verify the caller descends from Übersicht
  (`_ubersicht_child`), then `pgrep` for a live streamer and spawn one via
  `nohup` if missing.

Why the Übersicht-ancestor check: macOS attributes the audio-capture
permission to the *ancestor app*. An Übersicht child inherits its grant
silently; any other ancestor triggers a permission prompt. Never run this
script's spawn path from outside Übersicht.

`cava.conf` runs the streamer at 15 fps — deliberately low. The widget samples
at 5 fps, so a 15 fps streamer keeps latency under one poll interval while
writing frames 4× less often. Raise the widget's `refreshFrequency` and the
streamer's `framerate` together if you want more motion fidelity.

### Widget config (`audioVizWidgetOptions` in settings)

| Option | Default | Notes |
|---|---|---|
| `refreshFrequency` | 200 ms | Widget poll rate. Cache TTL is `refresh / 2` |
| `showOnDisplay` | all displays | |
| `cavaBinaryPath` | `/opt/homebrew/bin/cava` | |
| `cavaConfigPath` | `./simple-bar/lib/scripts/cava.conf` | Resolved relative to Übersicht's working directory |

Budget check for changing the poll rate: shell fast path ≈20–70 ms, streamer
staleness ≤ 66 ms (15 fps), CSS transition 80 ms. Polling faster than ~100 ms
won't gain motion quality unless the streamer framerate rises too.

## Known gotchas

- The WiFi widget (`wifi.jsx`) reads its options from `networkWidgetOptions`,
  not `wifiWidgetOptions` — there is no separate wifi block in
  `~/.simplebarrc`.
- A widget whose command cannot complete inside its interval will spawn
  continuously (rule 2 above). When adding a widget, time its command first.

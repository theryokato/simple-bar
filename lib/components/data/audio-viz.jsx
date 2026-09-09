import * as Uebersicht from "uebersicht";
import * as Utils from "../../utils";
import useWidgetRefresh from "../../hooks/use-widget-refresh";
import { useSimpleBarContext } from "../simple-bar-context.jsx";

export { audioVizStyles as styles } from "../../styles/components/data/audio-viz";

const { React } = Uebersicht;

const DEFAULT_REFRESH_FREQUENCY = 200;
const DEFAULT_CAVA_BINARY_PATH = "/opt/homebrew/bin/cava";
const DEFAULT_CAVA_CONFIG_PATH = "./simple-bar/lib/scripts/cava.conf";

/**
 * Audio visualization widget component.
 * Reads audio spectrum frames from a persistent cava process and renders them
 * as bars inside its own capsule, next to the spaces widget.
 * @returns {JSX.Element|null} The rendered widget component.
 */
export const Widget = React.memo(() => {
  const { displayIndex, settings } = useSimpleBarContext();
  const { widgets, audioVizWidgetOptions } = settings;
  const { audioVizWidget } = widgets;
  const { refreshFrequency, showOnDisplay, cavaBinaryPath, cavaConfigPath } =
    audioVizWidgetOptions;

  // Determine the refresh frequency for the widget
  const refresh = React.useMemo(
    () =>
      Utils.getRefreshFrequency(refreshFrequency, DEFAULT_REFRESH_FREQUENCY),
    [refreshFrequency],
  );

  // Determine if the widget should be visible on the current display
  const visible =
    Utils.isVisibleOnDisplay(displayIndex, showOnDisplay) && audioVizWidget;

  const [bars, setBars] = React.useState([]);

  const getFrame = React.useCallback(async () => {
    if (!visible) return;
    const output = await Utils.cachedRun(
      `sh ./simple-bar/lib/scripts/cava-viz.sh "${cavaBinaryPath || DEFAULT_CAVA_BINARY_PATH}" "${cavaConfigPath || DEFAULT_CAVA_CONFIG_PATH}"`,
      // Cache timeout must be shorter than the poll interval: with TTL ===
      // refresh, clock drift makes ~half the ticks resolve as cache hits,
      // halving the effective frame rate.
      refresh / 2,
    );
    // Frames are semicolon-separated values ranging from 0 to 100
    const values = Utils.cleanupOutput(output)
      .split(";")
      .map((value) => parseInt(value, 10))
      .filter((value) => !Number.isNaN(value));
    if (values.length) setBars(values);
  }, [visible, refresh, cavaBinaryPath, cavaConfigPath]);

  // Refresh the widget at the specified interval
  useWidgetRefresh(visible, getFrame, refresh);

  if (!visible || !bars.length) return null;

  // Cava emits all-zero frames when no audio is playing: keep the widget
  // mounted but collapsed, so it can animate back on the next frame.
  const idle = bars.every((value) => value === 0);
  const classes = Utils.classNames("audio-viz", {
    "audio-viz--idle": idle,
  });

  return (
    <div
      className={classes}
      style={{
        // Expanded max-width for the collapse transition: bars plus padding.
        "--audio-viz-max-width": `${bars.length * 5 - 2 + 20}px`,
      }}
    >
      {bars.map((value, i) => (
        <span
          key={i}
          style={{
            height: `${value}%`,
            backgroundImage: "var(--audio-viz-gradient)",
            // Slice one shared gradient across all bars. Stride (5px) and
            // region width (5n - 2) mirror the stylesheet: 3px bar + 2px gap.
            backgroundSize: `${bars.length * 5 - 2}px 100%`,
            backgroundPosition: `${i * -5}px 0`,
          }}
        />
      ))}
    </div>
  );
});

Widget.displayName = "AudioViz";

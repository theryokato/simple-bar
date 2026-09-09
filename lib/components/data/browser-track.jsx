import * as Uebersicht from "uebersicht";
import * as DataWidget from "./data-widget.jsx";
import * as DataWidgetLoader from "./data-widget-loader.jsx";
import * as Icons from "../icons/icons.jsx";
import { SuspenseIcon } from "../icons/icon.jsx";
import useWidgetRefresh from "../../hooks/use-widget-refresh";
import useServerSocket from "../../hooks/use-server-socket";
import { useSimpleBarContext } from "../simple-bar-context.jsx";
import * as Utils from "../../utils";

export { browserTrackStyles as styles } from "../../styles/components/data/browser-track";

const { React } = Uebersicht;

const DEFAULT_REFRESH_FREQUENCY = 10000;
const REFRESH_PLAYING_STATE_FREQUENCY = 2000;

const BROWSER_BUNDLE_IDS = {
  chrome: "com.google.Chrome",
  brave: "com.brave.Browser",
  safari: "com.apple.Safari",
  firefox: "org.mozilla.firefox",
  "firefox-dev": "org.mozilla.firefoxdev",
};

/**
 * BrowserTrack Widget component
 * @returns {JSX.Element|null} The BrowserTrack widget
 */
export const Widget = React.memo(() => {
  const { displayIndex, settings } = useSimpleBarContext();
  const { widgets, browserTrackWidgetOptions } = settings;
  const { browserTrackWidget } = widgets;
  const { refreshFrequency, showSpecter, showOnDisplay, showIcon } =
    browserTrackWidgetOptions;
  const visible =
    Utils.isVisibleOnDisplay(displayIndex, showOnDisplay) && browserTrackWidget;

  const refresh = React.useMemo(
    () =>
      Utils.getRefreshFrequency(refreshFrequency, DEFAULT_REFRESH_FREQUENCY),
    [refreshFrequency],
  );

  const ref = React.useRef();

  const [state, setState] = React.useState();
  const [loading, setLoading] = React.useState(visible);

  /**
   * Resets the widget state
   */
  const resetWidget = () => {
    setState(undefined);
    setLoading(false);
  };

  /**
   * Whether the given browser is currently the active audio source.
   * Declared before getBrowserTrack because its useCallback deps read it.
   */
  const isBrowserPlaying = React.useCallback(async (browser) => {
    const mediaOutput = await Utils.cachedRun("media-control get", 0);
    try {
      const media = JSON.parse(mediaOutput);
      return (
        media.bundleIdentifier === BROWSER_BUNDLE_IDS[browser] &&
        media.playbackRate > 0
      );
    } catch {
      // media-control missing or no Now Playing entry: not playing
      return false;
    }
  }, []);

  /**
   * Fetches the current browser track information
   */
  const getBrowserTrack = React.useCallback(async () => {
    if (!visible) return;
    const [firefoxStatus, firefoxDevStatus] = await Promise.all([
      Utils.cachedRun(
        `pgrep -xq 'Firefox' && echo "true" || echo "false"`,
        refresh,
      ),
      Utils.cachedRun(
        `pgrep -xq 'Firefox Developer Edition' && echo "true" || echo "false"`,
        refresh,
      ),
    ]);
    const isFirefoxDevRunning =
      Utils.cleanupOutput(firefoxDevStatus) === "true";
    const isFirefoxRunning = Utils.cleanupOutput(firefoxStatus) === "true";

    // Chromium browsers and Safari each get their own script: an AppleScript
    // referencing a browser that is not installed fails to compile entirely
    // (its terminology cannot be resolved), which would break every browser
    // at once. Each script mentions a single browser and is only executed
    // when that browser is actually running.
    const [chromeStatus, braveStatus, safariStatus] = await Promise.all([
      Utils.cachedRun(
        `pgrep -xq 'Google Chrome' && echo "true" || echo "false"`,
        refresh,
      ),
      Utils.cachedRun(
        `pgrep -xq 'Brave Browser' && echo "true" || echo "false"`,
        refresh,
      ),
      Utils.cachedRun(`pgrep -xq 'Safari' && echo "true" || echo "false"`, refresh),
    ]);
    const runningBrowser =
      Utils.cleanupOutput(chromeStatus) === "true"
        ? "chrome"
        : Utils.cleanupOutput(braveStatus) === "true"
          ? "brave"
          : Utils.cleanupOutput(safariStatus) === "true"
            ? "safari"
            : null;

    const scriptNamePrefix = isFirefoxDevRunning
      ? "firefox-dev"
      : isFirefoxRunning
        ? "firefox"
        : runningBrowser;

    if (!scriptNamePrefix) {
      setState(undefined);
      setLoading(false);
      return;
    }

    const browserTrackOutput = await Utils.cachedRun(
      `osascript ./simple-bar/lib/scripts/${scriptNamePrefix}-audio.applescript 2>&1`,
      refresh,
    );
    let browserTrack;
    try {
      browserTrack = JSON.parse(browserTrackOutput);
    } catch (error) {
      // A script error (missing automation permission, missing browser, …)
      // arrives as plain text: hide the widget instead of throwing
      // eslint-disable-next-line no-console
      console.error("Error parsing browser track output:", browserTrackOutput, error);
      setState(undefined);
      setLoading(false);
      return;
    }
    // media-control must run uncached so playback-state changes are seen
    // within one refresh cycle.
    const isPlaying = await isBrowserPlaying(scriptNamePrefix);
    setState({ ...browserTrack, isPlaying });
    setLoading(false);
  }, [visible, refresh, isBrowserPlaying]);

  // Latest state kept in a ref so the fast isPlaying poll can compare the
  // current browser's bundle id without depending on a stale closure.
  const stateRef = React.useRef();
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /**
   * Re-checks only the playing state on a fast cadence so the widget
   * disappears (or reappears) promptly when the tab starts/stops audio.
   */
  const updateIsPlaying = React.useCallback(async () => {
    if (!visible) return;
    const browser = stateRef.current?.browser;
    if (!browser) return;
    const isPlaying = await isBrowserPlaying(browser);
    setState((prev) =>
      prev && prev.isPlaying !== isPlaying ? { ...prev, isPlaying } : prev,
    );
  }, [visible, isBrowserPlaying]);

  useServerSocket(
    "browser-track",
    visible,
    getBrowserTrack,
    resetWidget,
    setLoading,
  );
  useWidgetRefresh(visible, getBrowserTrack, refresh);
  useWidgetRefresh(visible, updateIsPlaying, REFRESH_PLAYING_STATE_FREQUENCY);

  if (loading) return <DataWidgetLoader.Widget className="browser-track" />;
  if (!state) return null;
  const { browser, title, isPlaying } = state;

  if (!browser?.length || !title?.length || !isPlaying) return null;

  /**
   * Icon component for displaying browser and playing icons
   * @returns {JSX.Element} The icon component
   */
  const Icon = () => {
    const BrowserIcon = getIcon(browser);
    return (
      <div className="browser-track__icons">
        <SuspenseIcon>
          <BrowserIcon />
          <Icons.Playing />
        </SuspenseIcon>
      </div>
    );
  };

  return (
    <DataWidget.Widget
      ref={ref}
      classes="browser-track"
      Icon={showIcon ? Icon : null}
      showSpecter={showSpecter && isPlaying}
    >
      {title}
    </DataWidget.Widget>
  );
});

Widget.displayName = "BrowserTrack";

/**
 * Returns the appropriate icon component based on the browser name
 * @param {string} browser - The name of the browser
 * @returns {JSX.Element} The icon component for the browser
 */
function getIcon(browser) {
  if (browser === "chrome") return Icons.GoogleChrome;
  if (browser === "brave") return Icons.BraveBrowser;
  if (browser === "safari") return Icons.Safari;
  if (browser === "firefox") return Icons.Firefox;
  return Icons.Default;
}

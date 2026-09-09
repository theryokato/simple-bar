import * as Uebersicht from "uebersicht";
import * as DataWidget from "./data-widget.jsx";
import * as DataWidgetLoader from "./data-widget-loader.jsx";
import * as Icons from "../icons/icons.jsx";
import { SuspenseIcon } from "../icons/icon.jsx";
import useWidgetRefresh from "../../hooks/use-widget-refresh";
import useServerSocket from "../../hooks/use-server-socket";
import { useSimpleBarContext } from "../simple-bar-context.jsx";
import * as Utils from "../../utils";

export { nowPlayingStyles as styles } from "../../styles/components/data/now-playing";

const { React } = Uebersicht;

const DEFAULT_REFRESH_FREQUENCY = 3000;

// Media source icons by bundle identifier, Icons.Music as the fallback
const MEDIA_ICONS = {
  "com.apple.Music": Icons.Music,
  "com.apple.podcasts": Icons.Podcasts,
  "com.brave.Browser": Icons.BraveBrowser,
  "com.google.Chrome": Icons.BraveBrowser,
  "org.mozilla.firefox": Icons.Firefox,
  "com.apple.Safari": Icons.Safari,
  "com.spotify.client": Icons.Spotify,
};

/**
 * Now Playing widget: shows the current media title and artist for any app
 * feeding the macOS Now Playing service
 * @returns {JSX.Element|null} The now playing widget
 */
export const Widget = React.memo(() => {
  const { displayIndex, settings, pushMissive } = useSimpleBarContext();
  const { widgets, nowPlayingWidgetOptions } = settings;
  const { nowPlayingWidget } = widgets;
  const { refreshFrequency, showOnDisplay, showIcon } = nowPlayingWidgetOptions;

  const visible =
    Utils.isVisibleOnDisplay(displayIndex, showOnDisplay) && nowPlayingWidget;

  const refresh = React.useMemo(
    () =>
      Utils.getRefreshFrequency(refreshFrequency, DEFAULT_REFRESH_FREQUENCY),
    [refreshFrequency],
  );

  const [state, setState] = React.useState();
  const [loading, setLoading] = React.useState(visible);

  const resetWidget = () => {
    setState(undefined);
    setLoading(false);
  };

  /**
   * Fetches the current media state from media-control
   */
  const getNowPlaying = React.useCallback(async () => {
    if (!visible) return;
    try {
      // Übersicht's shell has no Homebrew in its PATH: resolve the binary
      // per-invocation with a Homebrew fallback
      const output = await Utils.cachedRun(
        "$(command -v media-control || echo /opt/homebrew/bin/media-control) get",
        refresh,
      );
      const media = JSON.parse(output);
      // Hide the widget when nothing is playing
      if (!media?.title?.length || !(media.playbackRate > 0)) {
        setState(undefined);
        setLoading(false);
        return;
      }
      setState(media);
    } catch (error) {
      // A media-control error (missing binary, nothing playing, plain-text
      // error output) must hide the widget, never leave it loading forever
      // eslint-disable-next-line no-console
      console.error("Error fetching now playing:", error);
      setState(undefined);
    }
    setLoading(false);
  }, [visible, refresh]);

  /**
   * Handles click event to toggle play/pause
   * @param {React.MouseEvent} e - The click event
   */
  const onClick = async (e) => {
    Utils.clickEffect(e);
    await Uebersicht.run("media-control toggle-play-pause");
    getNowPlaying();
  };

  /**
   * Handles right-click event to refresh the widget
   * @param {React.MouseEvent} e - The click event
   */
  const onRightClick = (e) => {
    Utils.clickEffect(e);
    setLoading(true);
    getNowPlaying();
    Utils.notification("Refreshing now playing...", pushMissive);
  };

  useServerSocket("now-playing", visible, getNowPlaying, resetWidget, setLoading);
  useWidgetRefresh(visible, getNowPlaying, refresh);

  if (loading) return <DataWidgetLoader.Widget className="now-playing" />;
  if (!state) return null;

  const { title, artist, bundleIdentifier } = state;
  const SourceIcon = MEDIA_ICONS[bundleIdentifier] ?? Icons.Music;

  const Icon = () => (
    <div className="now-playing__icons">
      <SuspenseIcon>
        <SourceIcon />
        <Icons.Playing />
      </SuspenseIcon>
    </div>
  );

  return (
    <DataWidget.Widget
      classes="now-playing"
      Icon={showIcon ? Icon : null}
      onClick={onClick}
      onRightClick={onRightClick}
    >
      {artist?.length ? `${title} — ${artist}` : title}
    </DataWidget.Widget>
  );
});

Widget.displayName = "NowPlaying";

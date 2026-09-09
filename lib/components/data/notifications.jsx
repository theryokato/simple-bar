/**
 * Notifications Widget
 *
 * Displays badge counts from running applications with active notifications.
 * Uses macOS lsappinfo to query app status labels (dock badges).
 *
 * Requirements:
 * - macOS (lsappinfo is macOS-specific)
 * - No special permissions required
 *
 * @module notifications
 */
import * as Uebersicht from "uebersicht";
import * as AppIcons from "../../app-icons.js";
import { SuspenseIcon } from "../icons/icon.jsx";
import useWidgetRefresh from "../../hooks/use-widget-refresh";
import useServerSocket from "../../hooks/use-server-socket";
import { useSimpleBarContext } from "../simple-bar-context.jsx";
import * as Utils from "../../utils";

export { notificationsStyles as styles } from "../../styles/components/data/notifications";

const { React } = Uebersicht;

const DEFAULT_REFRESH_FREQUENCY = 10000;

// Shell command to get notification badges from running apps
const COMMAND = `lsappinfo -all list 2>/dev/null | perl -0777 -pe 's/---/\\n---\\n/g' | perl -ne '
  if (/"CFBundleName"="([^"]+)"/) { $app = $1; }
  if (/"StatusLabel"=\\{ "label"="([^"]*)"/) { $badge = $1; }
  if (/"LSBundlePath"="([^"]+)"/) { $path = $1; }
  if (/^---$/ || eof) {
    print "$app|$badge|$path\\n" if ($app && $badge);
    ($app, $badge, $path) = ("", "", "");
  }
'`;

/**
 * Parses shell command output into notification objects.
 * @param {string} output - Raw command output from lsappinfo
 * @returns {Array<{name: string, badge: string, bundlePath: string}>} Array of notification objects
 */
function parseNotifications(output) {
  if (!output || !output.trim()) return [];

  return output
    .trim()
    .split("\n")
    .filter((line) => line.includes("|"))
    .map((line) => {
      const [name, badge, bundlePath] = line.split("|");
      return { name, badge, bundlePath };
    })
    .filter((item) => item.name && item.badge);
}

/**
 * Single app notification pill component.
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.app - Application notification data
 * @param {string} props.app.name - Application name
 * @param {string} props.app.badge - Badge count
 * @param {string} props.app.bundlePath - Path to application bundle
 * @returns {JSX.Element} Notification pill button
 */
const NotificationPill = React.memo(({ app }) => {
  /**
   * Opens the application when pill is clicked.
   * @param {React.MouseEvent} e - Click event
   */
  const openApp = async (e) => {
    Utils.clickEffect(e);
    // Escape special shell characters to prevent injection
    const safePath = app.bundlePath.replace(/["$`\\]/g, "\\$&");
    await Uebersicht.run(`open "${safePath}"`);
  };

  // Get the SVG icon for this app, or use Default
  const Icon = AppIcons.apps[app.name] || AppIcons.apps.Default;

  return (
    <button
      className="notification-pill"
      onClick={openApp}
      title={`${app.name}: ${app.badge} notification${app.badge !== "1" ? "s" : ""}`}
      aria-label={`Open ${app.name} - ${app.badge} notification${app.badge !== "1" ? "s" : ""}`}
    >
      <SuspenseIcon>
        <Icon className="notification-pill__icon" />
      </SuspenseIcon>
      <span className="notification-pill__badge">{app.badge}</span>
    </button>
  );
});

NotificationPill.displayName = "NotificationPill";

/**
 * Notification Badges widget component.
 * Shows each app with notifications as an inline pill.
 * @component
 * @returns {JSX.Element|null} The notifications widget component or null if no notifications
 */
export const Widget = React.memo(() => {
  const { displayIndex, settings } = useSimpleBarContext();
  const { widgets, notificationsWidgetOptions } = settings;
  const { notificationsWidget } = widgets;
  const { refreshFrequency, showOnDisplay, excludedApps } = notificationsWidgetOptions;

  // Determine if the widget should be visible based on display settings
  const visible =
    Utils.isVisibleOnDisplay(displayIndex, showOnDisplay) &&
    notificationsWidget;

  // Calculate the refresh frequency for the widget
  const refresh = React.useMemo(
    () =>
      Utils.getRefreshFrequency(refreshFrequency, DEFAULT_REFRESH_FREQUENCY),
    [refreshFrequency],
  );

  const [state, setState] = React.useState([]);
  const [loading, setLoading] = React.useState(visible);

  /**
   * Resets the widget state.
   */
  const resetWidget = React.useCallback(() => {
    setState([]);
    setLoading(false);
  }, []);

  // Build the exclusion list from the comma-separated setting
  const exclusionList = React.useMemo(
    () =>
      excludedApps
        ? excludedApps
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        : [],
    [excludedApps],
  );

  /**
   * Fetches notification badges and updates the state.
   */
  const getNotifications = React.useCallback(async () => {
    if (!visible) return;
    try {
      const output = await Utils.cachedRun(COMMAND, refresh);
      const notifications = parseNotifications(output).filter(
        (item) => !exclusionList.includes(item.name.toLowerCase()),
      );
      setState(notifications);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching notifications:", error);
      setState([]);
    }
    setLoading(false);
  }, [visible, refresh, exclusionList]);

  // Server socket for real-time updates
  useServerSocket(
    "notifications",
    visible,
    getNotifications,
    resetWidget,
    setLoading,
  );

  // Refresh the widget at the specified interval
  useWidgetRefresh(visible, getNotifications, refresh);

  // Don't render anything if loading or no notifications
  if (loading || !state.length) return null;

  return (
    <div className="notifications">
      {state.map((app) => (
        <NotificationPill key={app.bundlePath} app={app} />
      ))}
    </div>
  );
});

Widget.displayName = "Notifications";

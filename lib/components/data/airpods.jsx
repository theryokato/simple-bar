import * as Uebersicht from "uebersicht";
import * as DataWidget from "./data-widget.jsx";
import * as DataWidgetLoader from "./data-widget-loader.jsx";
import * as Icons from "../icons/icons.jsx";
import useWidgetRefresh from "../../hooks/use-widget-refresh";
import useServerSocket from "../../hooks/use-server-socket";
import { useSimpleBarContext } from "../simple-bar-context.jsx";
import * as Utils from "../../utils";

export { airpodsStyles as styles } from "../../styles/components/data/airpods";

const { React } = Uebersicht;

const DEFAULT_REFRESH_FREQUENCY = 1000 * 60 * 5;

/**
 * AirPods battery widget: shows the battery level of connected Bluetooth
 * headphones (left, right and case)
 * @returns {JSX.Element|null} The airpods widget
 */
export const Widget = React.memo(() => {
  const { displayIndex, settings, pushMissive } = useSimpleBarContext();
  const { widgets, airpodsWidgetOptions } = settings;
  const { airpodsWidget } = widgets;
  const { refreshFrequency, showOnDisplay, showIcon } = airpodsWidgetOptions;

  const visible =
    Utils.isVisibleOnDisplay(displayIndex, showOnDisplay) && airpodsWidget;

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
   * Fetches the battery levels of the connected headphones
   */
  const getAirpods = React.useCallback(async () => {
    if (!visible) return;
    const output = await Utils.cachedRun(
      "./simple-bar/lib/scripts/airpods-battery.sh",
      refresh,
    );
    const [left, right, airpodsCase] = Utils.cleanupOutput(output).split("|");
    // No headphones connected: hide the widget
    if (!left?.length && !right?.length && !airpodsCase?.length) {
      setState(undefined);
      setLoading(false);
      return;
    }
    setState({ left, right, airpodsCase });
    setLoading(false);
  }, [visible, refresh]);

  /**
   * Handles right-click event to refresh the widget
   * @param {React.MouseEvent} e - The click event
   */
  const onRightClick = (e) => {
    Utils.clickEffect(e);
    setLoading(true);
    getAirpods();
    Utils.notification("Refreshing AirPods battery...", pushMissive);
  };

  useServerSocket("airpods", visible, getAirpods, resetWidget, setLoading);
  useWidgetRefresh(visible, getAirpods, refresh);

  if (loading) return <DataWidgetLoader.Widget className="airpods" />;
  if (!state) return null;

  const { left, right, airpodsCase } = state;
  const levels = [
    ["L", left],
    ["C", airpodsCase],
    ["R", right],
  ].filter(([, value]) => value?.length);

  const lowest = Math.min(
    ...levels.map(([, value]) => parseInt(value, 10) || 100),
  );
  const classes = Utils.classNames("airpods", {
    "airpods--warning": lowest < 30,
    "airpods--low": lowest < 15,
  });

  const Icon = () => <Icons.Headphones />;

  return (
    <DataWidget.Widget
      classes={classes}
      Icon={showIcon ? Icon : null}
      onRightClick={onRightClick}
    >
      {levels.map(([side, value]) => `${value}%`).join(" | ")}
    </DataWidget.Widget>
  );
});

Widget.displayName = "AirPods";

import * as Uebersicht from "uebersicht";
import * as DataWidget from "./data-widget.jsx";
import * as DataWidgetLoader from "./data-widget-loader.jsx";
import * as Icons from "../icons/icons.jsx";
import * as Utils from "../../utils";
import useWidgetRefresh from "../../hooks/use-widget-refresh";
import useServerSocket from "../../hooks/use-server-socket";
import { useSimpleBarContext } from "../simple-bar-context.jsx";

export { weatherStyles as styles } from "../../styles/components/data/weather";

const { React } = Uebersicht;

const DEFAULT_REFRESH_FREQUENCY = 1000 * 60 * 30; // Default refresh frequency set to 30 minutes

// WMO weather interpretation codes mapped to descriptions whose wording keeps
// the substring matching in getIcon() working (rain/snow/fog/cloud/storm)
const WMO_DESCRIPTIONS = {
  0: "Sunny",
  1: "Mainly sunny",
  2: "Partly cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Rime fog",
  51: "Light rain",
  53: "Light rain",
  55: "Light rain",
  56: "Light rain",
  57: "Light rain",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Rain",
  67: "Rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

/**
 * Weather widget component
 */
export const Widget = React.memo(() => {
  const { displayIndex, settings, pushMissive } = useSimpleBarContext();
  const { widgets, weatherWidgetOptions } = settings;
  const { weatherWidget } = widgets;
  const {
    refreshFrequency,
    customLocation,
    unit,
    hideLocation,
    hideGradient,
    showOnDisplay,
    showIcon,
  } = weatherWidgetOptions;

  const refresh = React.useMemo(
    () =>
      Utils.getRefreshFrequency(refreshFrequency, DEFAULT_REFRESH_FREQUENCY),
    [refreshFrequency],
  );

  const visible =
    Utils.isVisibleOnDisplay(displayIndex, showOnDisplay) && weatherWidget;

  const [state, setState] = React.useState();
  const [loading, setLoading] = React.useState(visible);
  const geocodeCache = React.useRef({});

  /**
   * Resets the widget state and loading status
   */
  const resetWidget = () => {
    setState(undefined);
    setLoading(false);
  };

  /**
   * Fetches weather data from Open-Meteo, using the device's current location
   * (re-acquired on every refresh) or a geocoded custom location
   */
  const getWeather = React.useCallback(async () => {
    if (!visible) return;
    try {
      let latitude;
      let longitude;
      let city;

      if (customLocation.length) {
        const cached = geocodeCache.current[customLocation];
        if (cached) {
          ({ latitude, longitude, city } = cached);
        } else {
          const geo = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
              customLocation,
            )}&count=1`,
          ).then((r) => r.json());
          const hit = geo.results?.[0];
          if (!hit) return setLoading(false);
          latitude = hit.latitude;
          longitude = hit.longitude;
          city = hit.name;
          geocodeCache.current[customLocation] = { latitude, longitude, city };
        }
      } else {
        // Fresh position on every refresh so a moved device stays accurate
        const position = await Promise.race([getPosition(), Utils.timeout(5000)]);
        if (!position) return setLoading(false);
        // Übersicht's geolocation delivers { position: GeolocationPosition,
        // address: { city, zip, ... } } — not a bare GeolocationPosition
        latitude = position.position.coords.latitude;
        longitude = position.position.coords.longitude;
        city = position.address?.city || position.address?.zip || "";
      }

      const temperatureUnit = unit === "C" ? "celsius" : "fahrenheit";
      const result = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&forecast_days=1&timezone=auto&temperature_unit=${temperatureUnit}`,
      );
      const data = await result.json();
      setState({ location: city, data });
    } catch {
      // eslint-disable-next-line no-console
      console.error("Error while fetching weather");
    }
    setLoading(false);
  }, [visible, customLocation, unit]);

  useServerSocket("weather", visible, getWeather, resetWidget, setLoading);
  useWidgetRefresh(visible, getWeather, refresh);

  if (loading) return <DataWidgetLoader.Widget className="weather" />;
  if (!state || !state.data.current) return null;

  const { current, daily } = state.data;
  const temperature = Math.round(current.temperature_2m);

  const description = WMO_DESCRIPTIONS[current.weather_code] ?? "Sunny";
  const atNight = current.is_day === 0;

  const nowIntervalStart = new Date();
  nowIntervalStart.setHours(nowIntervalStart.getHours() - 1);
  const nowIntervalStop = new Date();
  nowIntervalStop.setHours(nowIntervalStop.getHours() + 1);
  // Open-Meteo returns local ISO times ("2026-09-09T06:45"), which the JS
  // Date parser treats as local time
  const sunriseTime = new Date(daily.sunrise[0]);
  const sunsetTime = new Date(daily.sunset[0]);

  const Icon = getIcon(description, atNight);
  const label = getLabel(state.location, temperature, unit, hideLocation);

  const sunRising =
    sunriseTime >= nowIntervalStart && sunriseTime <= nowIntervalStop;
  const sunSetting =
    sunsetTime >= nowIntervalStart && sunsetTime <= nowIntervalStop;

  /**
   * Handles right-click event to refresh weather data
   * @param {Event} e - The event object
   */
  const onRightClick = (e) => {
    Utils.clickEffect(e);
    setLoading(true);
    getWeather();
    Utils.notification("Refreshing forecast from Open-Meteo...", pushMissive);
  };

  const classes = Utils.classNames("weather", {
    "weather--sunrise": sunRising,
    "weather--sunset": sunSetting,
  });

  return (
    <DataWidget.Widget
      classes={classes}
      Icon={showIcon ? Icon : null}
      onRightClick={onRightClick}
      disableSlider
    >
      {!hideGradient && <div className="weather__gradient" />}
      {label}
    </DataWidget.Widget>
  );
});

Widget.displayName = "Weather";

/**
 * Returns the appropriate weather icon based on the description and time of day
 * @param {string} description - Weather description
 * @param {boolean} atNight - Whether it is currently night time
 * @returns {JSX.Element} - The weather icon component
 */
function getIcon(description, atNight) {
  if (description.includes("fog") || description.includes("mist")) {
    return Icons.Fog;
  }
  if (description.includes("storm")) return Icons.Storm;
  if (description.includes("snow")) return Icons.Snow;
  if (description.includes("rain")) return Icons.Rain;
  if (description.includes("cloud")) return Icons.Cloud;
  if (atNight) return Icons.Moon;
  return Icons.Sun;
}

/**
 * Returns the label for the weather widget
 * @param {string} location - The location name
 * @param {string} temperature - The temperature value
 * @param {string} unit - The temperature unit (C or F)
 * @param {boolean} hideLocation - Whether to hide the location name
 * @returns {string} - The label text
 */
function getLabel(location, temperature, unit, hideLocation) {
  // Without a resolved city name (e.g. reverse geocoding failed) fall back to
  // showing just the temperature instead of "Fetching..." forever
  if (!location) return `${temperature}°${unit}`;
  if (hideLocation) return `${temperature}°${unit}`;
  return `${location}, ${temperature}°${unit}`;
}

/**
 * Gets the current geographical position of the user
 * @returns {Promise<GeolocationPosition>} - The position object
 */
async function getPosition() {
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(resolve),
  );
}

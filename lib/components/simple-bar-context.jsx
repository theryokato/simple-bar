import * as Uebersicht from "uebersicht";
import * as Aerospace from "../aerospace.js";

const { React } = Uebersicht;

// Create a context with default values
const SimpleBarContext = React.createContext({
  display: 1,
  SIPDisabled: false,
  settings: {},
  setSettings: () => {},
});

/**
 * Custom hook to use the SimpleBarContext
 * @returns {Object} The context value
 */
export function useSimpleBarContext() {
  return React.useContext(SimpleBarContext);
}

/**
 * Provides context for simple-bar.
 *
 * @param {Object} props - The properties object.
 * @param {Object} props.initialSettings - The initial settings for the application.
 * @param {Array} props.displays - The initial displays configuration.
 * @param {boolean} props.SIPDisabled - Indicates if SIP (System Integrity Protection) is disabled.
 * @param {React.ReactNode} props.children - The child components to be wrapped by the provider.
 *
 * @returns {JSX.Element} The context provider component.
 */
export default function SimpleBarContextProvider({
  initialSettings,
  displays,
  SIPDisabled,
  children,
}) {
  const [settings, setSettings] = React.useState(initialSettings);
  const [_displays, setDisplays] = React.useState(displays);
  const [missives, setMissives] = React.useState([]);
  const [ubersichtScreens, setUbersichtScreens] = React.useState([]);

  const { windowManager, enableServer, yabaiServerRefresh } = settings.global;
  const serverEnabled = enableServer && yabaiServerRefresh;
  const isYabai = windowManager === "yabai";

  const currentDisplays = serverEnabled && isYabai ? _displays : displays;

  const ubersichtDisplayId = parseInt(
    window.location.pathname.replace("/", ""),
    10,
  );

  // Fetch Übersicht's active screen list from /state/
  React.useEffect(() => {
    if (isYabai) return undefined;

    const controller = new AbortController();

    const loadScreens = async () => {
      try {
        const response = await fetch("/state/", { signal: controller.signal });
        if (!response.ok) throw new Error("Failed to load /state/");
        const state = await response.json();
        setUbersichtScreens(Array.isArray(state?.screens) ? state.screens : []);
      } catch (error) {
        if (error?.name !== "AbortError") {
          setUbersichtScreens([]);
        }
      }
    };

    loadScreens();
    return () => controller.abort();
  }, [displays, isYabai]);

  // Derive the current display rank from the active Übersicht screen order.
  // This handles phantom displays (closed lid, previously connected monitors)
  // that Übersicht still counts but AeroSpace doesn't report.
  const currentScreenRank = ubersichtScreens.indexOf(ubersichtDisplayId) + 1;

  // Match the current display using either the yabai display ID or AeroSpace's custom display index logic.
  const currentDisplay =
    currentDisplays?.find((display) =>
      isYabai
        ? display.id === ubersichtDisplayId
        : Aerospace.getDisplayIndex(display) === currentScreenRank,
    ) || {};

  // Determine the display index for context value
  // currentDisplay.index is from yabai
  // Aerospace.getDisplayIndex is from AeroSpace with custom logic
  // Fallback to AeroSpace monitor-appkit-nsscreen-screens-id or default to 1
  const displayIndex =
    currentDisplay.index ?? Aerospace.getDisplayIndex(currentDisplay) ?? 1;

  const pushMissive = (newMissive) => {
    const now = Date.now();
    const { content, side = "right", delay = 5000 } = newMissive;
    const timeout =
      typeof delay === "number" && delay !== 0
        ? setTimeout(() => {
            setMissives((current) => {
              return current.filter((m) => m.id !== now);
            });
          }, delay)
        : undefined;
    setMissives((current) => {
      return [...current, { id: now, content, side, timeout }];
    });
  };

  return (
    <SimpleBarContext.Provider
      value={{
        displayIndex,
        SIPDisabled,
        settings,
        setSettings,
        displays: currentDisplays,
        setDisplays,
        missives,
        setMissives,
        pushMissive,
      }}
    >
      {children}
    </SimpleBarContext.Provider>
  );
}

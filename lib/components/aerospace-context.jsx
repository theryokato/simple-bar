import * as Uebersicht from "uebersicht";
import { useSimpleBarContext } from "./simple-bar-context.jsx";
import useServerSocket from "../hooks/use-server-socket.js";
import * as Aerospace from "../aerospace.js";

const { React } = Uebersicht;

// Create a context with default values
const AerospaceContext = React.createContext({
  spaces: [],
  windows: [],
  mode: "",
});

/**
 * Custom hook to use the AerospaceContext
 * @returns {Object} The context value
 */
export function useAerospaceContext() {
  return React.useContext(AerospaceContext);
}

// Memoized AerospaceContextProvider component
export default React.memo(AerospaceContextProvider);

/**
 * AerospaceContextProvider component
 * @param {Object} props - The component props
 * @param {React.ReactNode} props.children - The child components
 * @returns {JSX.Element} The provider component
 */
function AerospaceContextProvider({ children }) {
  // Get settings, displayIndex, and displays from SimpleBarContext
  const { settings, displayIndex, displays } = useSimpleBarContext();
  const { enableServer, aerospaceServerRefresh } = settings.global;
  const serverEnabled = enableServer && aerospaceServerRefresh;

  // State to store aerospace spaces
  const [aerospaceSpaces, setAerospaceSpaces] = React.useState([]);
  const latestRequestRef = React.useRef(0);
  const retryTimeoutRef = React.useRef(null);
  const retryDelayRef = React.useRef(1000);

  // Fetches and sets the aerospace spaces. Any failure keeps the previous
  // state on screen and schedules a single retry instead of leaving the
  // widget stale with an unhandled rejection.
  const getSpaces = React.useCallback(async () => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    try {
      let focusedWindow = {};
      const [focusedSpace] = await Aerospace.getFocusedSpace();
      try {
        [focusedWindow] = await Aerospace.getFocusedWindow();
        // eslint-disable-next-line no-empty
      } catch {}
      const spaces = await Promise.all(
        displays.map(async (display) => {
          const id = display["monitor-id"];
          const result = await Aerospace.getSpaces(id);
          return Promise.all(
            result.map(async (space) => {
              const focused = space.workspace === focusedSpace.workspace;
              const monitor = Aerospace.getDisplayIndex(space);
              const windows = await Aerospace.getWindows(space.workspace);
              const formatted = windows.map((window) => {
                const focused =
                  window["window-id"] === focusedWindow["window-id"];
                return {
                  ...window,
                  focused,
                };
              });
              return { ...space, windows: formatted, focused, monitor };
            })
          );
        })
      );
      if (requestId !== latestRequestRef.current) {
        return;
      }
      setAerospaceSpaces(spaces.flat());
      // Connection is healthy again, reset the backoff
      retryDelayRef.current = 1000;
    } catch (e) {
      if (requestId !== latestRequestRef.current) {
        return;
      }
      // A newer refresh is already running or scheduled: let it win
      if (retryTimeoutRef.current !== null) {
        return;
      }
      // Retry with a capped exponential backoff instead of hammering the
      // aerospace CLI every 2s while it is unavailable
      retryTimeoutRef.current = setTimeout(() => {
        retryTimeoutRef.current = null;
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000);
        getSpaces();
      }, retryDelayRef.current);
    }
  }, [displays]);

  // Clears a pending retry when the provider unmounts
  React.useEffect(
    () => () => {
      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    },
    []
  );

  // Refreshes spaces with the data sent by simple-bar-server if it exists
  // in order to speed up the process then refreshes everything in background
  // else, simply refreshes everything
  const refreshSpaces = React.useCallback(
    async (data) => {
      if (data && data.space !== undefined) {
        const { space } = data;
        setAerospaceSpaces((current) => {
          return current.map((s) => ({ ...s, focused: s.workspace === space }));
        });
        getSpaces();
      } else {
        await getSpaces();
      }
    },
    [getSpaces]
  );

  // Resets the aerospace spaces state
  const resetSpaces = () => {
    setAerospaceSpaces([]);
  };

  // Use server socket to fetch and reset spaces
  useServerSocket("spaces", serverEnabled, refreshSpaces, resetSpaces);

  // Fetch spaces on component mount and when displayIndex changes
  React.useEffect(() => {
    refreshSpaces();
  }, [refreshSpaces, displayIndex]);

  return (
    <AerospaceContext.Provider value={{ spaces: aerospaceSpaces }}>
      {children}
    </AerospaceContext.Provider>
  );
}

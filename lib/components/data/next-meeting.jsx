/**
 * Next Meeting Widget
 *
 * Displays the next upcoming calendar event with time until start and optional join button.
 * Uses icalBuddy for fast calendar access with proper recurring event support.
 *
 * Requirements:
 * - macOS with Calendar.app or compatible calendar
 * - icalBuddy installed (brew install ical-buddy)
 * - Calendar access permissions granted
 *
 * @module next-meeting
 */
import * as Uebersicht from "uebersicht";
import * as DataWidget from "./data-widget.jsx";
import * as DataWidgetLoader from "./data-widget-loader.jsx";
import * as Icons from "../icons/icons.jsx";
import useWidgetRefresh from "../../hooks/use-widget-refresh";
import useServerSocket from "../../hooks/use-server-socket";
import { useSimpleBarContext } from "../simple-bar-context.jsx";
import * as Utils from "../../utils";

export { nextMeetingStyles as styles } from "../../styles/components/data/next-meeting";

const { React } = Uebersicht;

const DEFAULT_REFRESH_FREQUENCY = 60000; // 1 minute

// Timing thresholds (in minutes)
const URGENT_THRESHOLD = 5; // Red pulsing when ≤5 min until meeting
const UPCOMING_THRESHOLD = 15; // Yellow when ≤15 min until meeting

// Uses icalBuddy for fast calendar access (handles recurring events properly)
// Note: Shell script automatically skips meetings that started more than 15 minutes ago
const BASE_COMMAND = `./simple-bar/lib/scripts/next-meeting.sh`;

/**
 * Builds the shell command with optional custom icalBuddy path and look-ahead hours.
 * @param {string} icalBuddyPath - Optional custom path to icalBuddy binary
 * @param {number} lookAheadHours - Hours to look ahead for meetings (default: 12)
 * @returns {string} Complete shell command
 */
function buildCommand(icalBuddyPath, lookAheadHours) {
  const hours = lookAheadHours || 12;
  if (icalBuddyPath && icalBuddyPath.trim()) {
    // Escape special shell characters to prevent injection
    const safePath = icalBuddyPath.replace(/["$`\\]/g, "\\$&");
    return `${BASE_COMMAND} "${safePath}" ${hours}`;
  }
  return `${BASE_COMMAND} "" ${hours}`;
}

// Patterns to extract meeting URLs from notes
const MEETING_URL_PATTERNS = [
  /https?:\/\/[\w-]*\.?zoom\.us\/[^\s<>"]+/gi,
  /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"]+/gi,
  /https?:\/\/meet\.google\.com\/[^\s<>"]+/gi,
  /https?:\/\/[\w-]*\.?webex\.com\/[^\s<>"]+/gi,
];

// SafeLinks pattern (Microsoft Outlook protection wrapper)
const SAFELINKS_PATTERN =
  /https?:\/\/[\w.-]*safelinks\.protection\.outlook\.com\/[^\s<>">\]]+/gi;

/**
 * Decode a URL that may be URL-encoded
 * @param {string} url - Possibly encoded URL
 * @returns {string} Decoded URL
 */
function decodeUrl(url) {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

/**
 * Extract the real URL from a SafeLink wrapper
 * @param {string} safeLink - SafeLink URL
 * @returns {string} Extracted real URL or original
 */
function extractFromSafeLink(safeLink) {
  const urlParam = safeLink.match(/[?&]url=([^&]+)/i);
  if (urlParam && urlParam[1]) {
    return decodeUrl(urlParam[1]);
  }
  return safeLink;
}

/**
 * Extract meeting URL from event URL or notes
 * @param {string} url - Event URL
 * @param {string} notes - Event notes/description
 * @returns {string|null} Meeting URL or null
 */
function extractMeetingUrl(url, notes) {
  // First check direct URL
  if (url && url.trim() && url !== "missing value") {
    for (const pattern of MEETING_URL_PATTERNS) {
      pattern.lastIndex = 0;
      const match = url.match(pattern);
      if (match) return match[0];
    }
    if (url.startsWith("http")) return url;
  }

  // Check notes for meeting links
  if (notes && notes.trim()) {
    // First try direct meeting URLs
    for (const pattern of MEETING_URL_PATTERNS) {
      pattern.lastIndex = 0;
      const match = notes.match(pattern);
      if (match) return match[0];
    }

    // Check for SafeLinks that contain meeting URLs
    SAFELINKS_PATTERN.lastIndex = 0;
    const safeLinks = notes.match(SAFELINKS_PATTERN);
    if (safeLinks) {
      for (const safeLink of safeLinks) {
        const realUrl = extractFromSafeLink(safeLink);
        for (const pattern of MEETING_URL_PATTERNS) {
          pattern.lastIndex = 0;
          if (pattern.test(realUrl)) {
            return realUrl;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Format time until meeting
 * @param {number} minutes - Minutes until meeting
 * @returns {string} Formatted time string
 */
function formatTimeUntil(minutes) {
  if (minutes < 0) return "now";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Parse meeting data from shell script output
 * @param {string} output - Raw command output
 * @returns {Object|null} Meeting object or null
 */
function parseMeetingData(output) {
  if (!output || !output.trim()) return null;

  const parts = output.trim().split("|");
  if (parts.length < 5) return null;

  const [title, startTime, url, notes, minutesUntil] = parts;
  if (!title) return null;

  const meetingUrl = extractMeetingUrl(url, notes);

  return {
    title: title.trim(),
    startTime: startTime,
    url: meetingUrl,
    minutesUntil: parseInt(minutesUntil, 10) || 0,
  };
}

/**
 * Join button sub-component for meeting URLs.
 * @component
 * @param {Object} props - Component props
 * @param {string} props.url - Meeting URL to open
 * @returns {JSX.Element} Join button element
 */
const JoinButton = React.memo(({ url }) => {
  /**
   * Opens the meeting URL when clicked.
   * @param {React.MouseEvent} e - Click event
   */
  const handleJoin = async (e) => {
    e.stopPropagation();
    Utils.clickEffect(e);
    // Escape special shell characters to prevent injection
    const safeUrl = url.replace(/["$`\\]/g, "\\$&");
    await Uebersicht.run(`open "${safeUrl}"`);
  };

  return (
    <button
      className="next-meeting__join"
      onClick={handleJoin}
      title="Join meeting"
      aria-label="Join video meeting"
    >
      Join
    </button>
  );
});

JoinButton.displayName = "JoinButton";

/**
 * Next Meeting widget component
 * Shows the next upcoming meeting with optional join button
 * @returns {JSX.Element|null} The next meeting widget
 */
export const Widget = React.memo(() => {
  const { displayIndex, settings } = useSimpleBarContext();
  const { widgets, nextMeetingWidgetOptions, dateWidgetOptions } = settings;
  const { nextMeetingWidget } = widgets;
  const {
    refreshFrequency,
    showOnDisplay,
    showJoinButton,
    showTimeOnly,
    icalBuddyPath,
    lookAheadHours,
  } = nextMeetingWidgetOptions;

  // Calculate the refresh frequency for the widget
  const refresh = React.useMemo(
    () =>
      Utils.getRefreshFrequency(refreshFrequency, DEFAULT_REFRESH_FREQUENCY),
    [refreshFrequency],
  );

  // Determine if the widget should be visible based on display settings
  const visible =
    Utils.isVisibleOnDisplay(displayIndex, showOnDisplay) && nextMeetingWidget;

  const [state, setState] = React.useState(null);
  const [loading, setLoading] = React.useState(visible);

  /**
   * Resets the widget state.
   */
  const resetWidget = React.useCallback(() => {
    setState(null);
    setLoading(false);
  }, []);

  /**
   * Fetches next meeting and updates the state.
   */
  const getMeeting = React.useCallback(async () => {
    if (!visible) return;
    try {
      const command = buildCommand(icalBuddyPath, lookAheadHours);
      const output = await Uebersicht.run(command);
      const meeting = parseMeetingData(output);
      setState(meeting);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching next meeting:", error);
      setState(null);
    }
    setLoading(false);
  }, [visible, icalBuddyPath, lookAheadHours]);

  // Server socket for real-time updates
  useServerSocket("next-meeting", visible, getMeeting, resetWidget, setLoading);

  // Refresh the widget at the specified interval
  useWidgetRefresh(visible, getMeeting, refresh);

  if (loading) return <DataWidgetLoader.Widget className="next-meeting" />;
  if (!state) return null;

  const { title, minutesUntil, url } = state;
  const timeDisplay = formatTimeUntil(minutesUntil);
  const isUrgent = minutesUntil <= URGENT_THRESHOLD; // Red pulsing: ≤5 min or in progress (up to 15 min)
  const isUpcoming = minutesUntil <= UPCOMING_THRESHOLD; // Yellow: ≤15 min (but not urgent/in-progress)

  const widgetClasses = Utils.classNames("next-meeting", {
    "next-meeting--urgent": isUrgent,
    "next-meeting--upcoming": isUpcoming && !isUrgent,
  });

  /**
   * Handle click event to open the calendar application
   * @param {Event} e - The click event
   */
  const openCalendar = async (e) => {
    Utils.clickEffect(e);
    const calendarApp = dateWidgetOptions?.calendarApp || "Calendar";
    await Uebersicht.run(`open -a "${calendarApp}"`);
  };

  return (
    <DataWidget.Widget
      classes={widgetClasses}
      Icon={Icons.Calendar}
      onClick={openCalendar}
      useDivForClick
    >
      {!showTimeOnly && <span className="next-meeting__title">{title}</span>}
      <span className="next-meeting__time">{timeDisplay}</span>
      {showJoinButton && url && <JoinButton url={url} />}
    </DataWidget.Widget>
  );
});

Widget.displayName = "NextMeeting";

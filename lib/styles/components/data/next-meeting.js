// Styles for /lib/components/data/next-meeting.jsx component
export const nextMeetingStyles = /* css */ `
.next-meeting {
  background-color: var(--cyan);
}
.simple-bar--widgets-background-color-as-foreground .next-meeting {
  color: var(--cyan);
  background-color: transparent;
}
.simple-bar--no-color-in-data .next-meeting {
  background-color: var(--minor);
}
.next-meeting--upcoming {
  background-color: var(--yellow) !important;
}
.simple-bar--widgets-background-color-as-foreground .next-meeting--upcoming {
  color: var(--yellow);
  background-color: transparent !important;
}
.next-meeting--urgent {
  background-color: var(--red) !important;
  animation: next-meeting-pulse 1.5s ease-in-out infinite;
}
.simple-bar--widgets-background-color-as-foreground .next-meeting--urgent {
  color: var(--red);
  background-color: transparent !important;
}
@keyframes next-meeting-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
.simple-bar--animations-disabled .next-meeting--urgent {
  animation: none;
}
.next-meeting__title {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 6px;
}
.next-meeting__time {
  font-weight: 600;
  opacity: 0.9;
}
.next-meeting__join {
  margin-left: 6px;
  padding: 2px 6px;
  background-color: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 3px;
  color: inherit;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 160ms var(--transition-easing),
              transform 160ms var(--transition-easing);
}
.next-meeting__join:hover {
  background-color: rgba(255, 255, 255, 0.35);
  transform: translateY(-1px);
}
.next-meeting__join:active {
  transform: translateY(0);
}
.next-meeting__join:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
}
`;

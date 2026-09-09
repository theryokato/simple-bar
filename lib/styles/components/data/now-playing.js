// Styles for /lib/components/data/now-playing.jsx
export const nowPlayingStyles = /* css */ `
.now-playing {
  position: relative;
  background-color: var(--green);
}
.simple-bar--widgets-background-color-as-foreground .now-playing {
  color: var(--green);
  background-color: transparent;
}
.now-playing__icons {
  position: relative;
}
.now-playing__icons > svg:nth-of-type(1),
.now-playing__icons > svg:nth-of-type(2) {
  width: 10px;
  height: 10px;
  fill: currentColor;
}
.now-playing__icons > svg:nth-of-type(1) {
  margin-right: 7px;
}
.simple-bar--no-color-in-data .now-playing__icons > svg:nth-of-type(1) {
  fill: currentColor;
}
.now-playing__icons > svg:nth-of-type(2) {
  position: absolute;
  bottom: -1px;
  right: 2px;
  stroke: var(--green);
  stroke-width: 3px;
}
.simple-bar--widgets-background-color-as-foreground .now-playing__icons > svg:nth-of-type(2) {
  stroke: var(--background);
}
.simple-bar--no-color-in-data .now-playing__icons > svg:nth-of-type(2) {
  fill: currentColor;
  stroke: var(--minor);
}
`;

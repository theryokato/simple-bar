// Styles for /lib/components/data/audio-viz.jsx component
export const audioVizStyles = /* css */ `
.audio-viz {
  flex: 0 0 auto;
  align-self: stretch;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: var(--item-inner-margin);
  margin: var(--item-outer-margin);
  /* Mirrors the horizontal gradient configured in lib/scripts/cava.conf [color].
     Raw output mode does not transmit colors, so the widget renders it itself. */
  --audio-viz-gradient: linear-gradient(
    90deg,
    #ed8796,
    #f5a97f,
    #eed49f,
    #a6da95,
    #8bd5ca,
    #8aadf4,
    #c6a0f6,
    #f5bde6
  );
  background-color: var(--minor);
  border-radius: var(--item-radius);
  box-shadow: var(--light-shadow);
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}
.simple-bar--no-bar-background .audio-viz {
  padding: 4px 5px;
  background-color: var(--background);
  border-radius: var(--bar-radius);
}
.simple-bar--no-bar-background.simple-bar--no-shadow .audio-viz,
.simple-bar--no-shadow .audio-viz {
  box-shadow: none;
}
.audio-viz > span {
  flex: 0 0 3px;
  width: 3px;
  min-height: 2px;
  background-color: var(--foreground);
  border-radius: 1px;
  transition: height 160ms var(--transition-easing);
}
.simple-bar--animations-disabled .audio-viz > span {
  transition: none;
}
`;


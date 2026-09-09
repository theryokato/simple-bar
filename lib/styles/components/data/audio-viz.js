// Styles for /lib/components/data/audio-viz.jsx component
export const audioVizStyles = /* css */ `
.audio-viz {
  flex: 0 0 auto;
  align-self: stretch;
  display: flex;
  align-items: center;
  gap: 2px;
  /* Set from the component: bars width plus padding, so max-width is
     animatable between the expanded and collapsed states. */
  max-width: var(--audio-viz-max-width, 400px);
  padding: var(--item-inner-margin);
  margin: var(--item-outer-margin);
  /* Theme-driven spectrum across the palette variables from
     lib/styles/core/variables.js; follows the applied theme (and any
     custom color overrides set in the settings panel). */
  --audio-viz-gradient: linear-gradient(
    90deg,
    var(--red),
    var(--orange),
    var(--yellow),
    var(--green),
    var(--cyan),
    var(--blue),
    var(--magenta),
    var(--red)
  );
  background-color: var(--minor);
  border-radius: var(--item-radius);
  box-shadow: var(--light-shadow);
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  transition: max-width 320ms var(--transition-easing), padding 320ms var(--transition-easing),
    margin 320ms var(--transition-easing), opacity 320ms var(--transition-easing);
}
.audio-viz--idle {
  max-width: 0;
  padding-left: 0;
  padding-right: 0;
  margin-left: 0;
  margin-right: 0;
  opacity: 0;
}
.simple-bar--animations-disabled .audio-viz {
  transition: none;
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


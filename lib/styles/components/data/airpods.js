// Styles for /lib/components/data/airpods.jsx
export const airpodsStyles = /* css */ `
.airpods {
  position: relative;
  background-color: var(--magenta);
}
.simple-bar--widgets-background-color-as-foreground .airpods {
  color: var(--magenta);
  background-color: transparent;
}
.airpods > svg {
  width: 10px;
  height: 10px;
  fill: currentColor;
  margin-right: 7px;
}
.simple-bar--no-color-in-data .airpods > svg {
  fill: currentColor;
}
.airpods--warning {
  background-color: var(--yellow);
}
.simple-bar--widgets-background-color-as-foreground .airpods--warning {
  color: var(--yellow);
}
.airpods--low {
  background-color: var(--red);
}
.simple-bar--widgets-background-color-as-foreground .airpods--low {
  color: var(--red);
}
`;

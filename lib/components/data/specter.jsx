import * as Uebersicht from "uebersicht";

export { specterStyles as styles } from "../../styles/components/data/specter";

const { React } = Uebersicht;

/**
 * Specter widget component.
 * Renders the classic six-span CSS animation.
 * @returns {JSX.Element} The rendered widget component
 */
export const Widget = React.memo(() => (
  <div className="specter">
    {[...new Array(6)].map((_, i) => (
      <span key={i} />
    ))}
  </div>
));

Widget.displayName = "Specter";

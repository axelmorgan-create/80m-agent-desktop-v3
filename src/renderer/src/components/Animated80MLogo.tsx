import type { CSSProperties } from "react";
import agentWordmarkUrl from "../assets/80m-agent-wordmark.svg";
import logoUrl from "../assets/80m-logo.svg";

interface Animated80MLogoProps {
  className?: string;
}

const Animated80MLogo: React.FC<Animated80MLogoProps> = ({ className }) => {
  return (
    <span
      className={["animated-80m-logo", className].filter(Boolean).join(" ")}
      style={
        {
          "--logo-mask": `url("${logoUrl}")`,
          "--agent-mask": `url("${agentWordmarkUrl}")`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <span className="animated-80m-logo-main" />
      <span className="animated-80m-logo-agent" />
    </span>
  );
};

export default Animated80MLogo;

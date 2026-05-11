import type React from "react";
import generatedIconSprite from "../../assets/generated-icons/eighty-m-generated-icons.svg";

export type Generated80mIconName =
  | "chat"
  | "history"
  | "kanban"
  | "skills"
  | "tools"
  | "soul"
  | "gateway"
  | "settings"
  | "gear"
  | "medical";

const GENERATED_ICON_VIEWBOX: Record<Generated80mIconName, string> = {
  chat: "25 155 310 310",
  history: "380 145 300 300",
  kanban: "705 145 295 295",
  skills: "50 515 295 295",
  tools: "365 515 320 320",
  soul: "700 505 330 330",
  gear: "35 900 330 330",
  gateway: "360 900 340 340",
  settings: "695 900 330 330",
  medical: "370 1260 300 300",
};

interface Generated80mIconProps {
  className?: string;
  name: Generated80mIconName;
  size?: number;
  title?: string;
}

export function Generated80mIcon({
  className,
  name,
  size = 18,
  title,
}: Generated80mIconProps): React.JSX.Element {
  const titleId = title
    ? `generated-80m-icon-${name}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    : undefined;

  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-labelledby={titleId}
      className={className}
      focusable="false"
      height={size}
      preserveAspectRatio="xMidYMid meet"
      role={title ? "img" : undefined}
      viewBox={GENERATED_ICON_VIEWBOX[name]}
      width={size}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      <use href={`${generatedIconSprite}#eighty-m-generated-icon-sheet`} />
    </svg>
  );
}

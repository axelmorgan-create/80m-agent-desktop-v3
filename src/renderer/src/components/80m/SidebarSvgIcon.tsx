import type React from "react";

export type SidebarSvgIconName =
  | "chat"
  | "history"
  | "kanban"
  | "skills"
  | "tools"
  | "soul"
  | "gateway"
  | "settings";

interface SidebarSvgIconProps {
  className?: string;
  name: SidebarSvgIconName;
  size?: number;
  title?: string;
}

const iconPaths: Record<SidebarSvgIconName, React.JSX.Element> = {
  chat: (
    <>
      <path d="M6.5 7.6h11a3.9 3.9 0 0 1 3.9 3.9v.7a3.9 3.9 0 0 1-3.9 3.9h-5.1l-4.2 3.1.4-3.1H6.5a3.9 3.9 0 0 1-3.9-3.9v-.7a3.9 3.9 0 0 1 3.9-3.9Z" />
      <path className="sidebar-svg-icon-detail" d="M7.6 11h8.8M7.6 13.6h5.7" />
      <path className="sidebar-svg-icon-spark" d="M18.4 3.4v2.4M17.2 4.6h2.4" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.35-5.65" />
      <path d="M4 5.2v4h4" />
      <path className="sidebar-svg-icon-detail" d="M12 7.8v4.7l3.2 1.9" />
      <path className="sidebar-svg-icon-spark" d="M17.8 4.5l1.7-1.7" />
    </>
  ),
  kanban: (
    <>
      <rect x="3.4" y="5.1" width="17.2" height="14.4" rx="2.2" />
      <path d="M8.9 5.1v14.4M15.1 5.1v14.4" />
      <path
        className="sidebar-svg-icon-detail"
        d="M5.8 8.4h1.4M11.4 8.4h1.2M17.5 8.4h1"
      />
      <path
        className="sidebar-svg-icon-detail"
        d="M5.8 12.2h1.4M11.4 13.3h1.2M17.5 11.4h1"
      />
    </>
  ),
  skills: (
    <>
      <path d="M12 3.5 19.8 8v8L12 20.5 4.2 16V8L12 3.5Z" />
      <path
        className="sidebar-svg-icon-detail"
        d="M12 8.1v7.8M8.6 10.1l6.8 3.8M15.4 10.1l-6.8 3.8"
      />
      <circle className="sidebar-svg-icon-node" cx="12" cy="8.1" r="1" />
      <circle className="sidebar-svg-icon-node" cx="8.6" cy="15.7" r="1" />
      <circle className="sidebar-svg-icon-node" cx="15.4" cy="15.7" r="1" />
    </>
  ),
  tools: (
    <>
      <path d="m14.2 5.4 4.4 4.4" />
      <path d="m16.8 3.2 4 4-2.2 2.2-4-4 2.2-2.2Z" />
      <path d="m9.5 13.1-5 5a2 2 0 0 0 2.8 2.8l5-5" />
      <path
        className="sidebar-svg-icon-detail"
        d="M4.8 5.3 18.7 19.2M4.2 4.2l3.4.7.7 3.4"
      />
    </>
  ),
  soul: (
    <>
      <path d="M12 20.4s6.6-4.2 6.6-10a6.6 6.6 0 0 0-13.2 0c0 5.8 6.6 10 6.6 10Z" />
      <path
        className="sidebar-svg-icon-detail"
        d="M8.1 11.2c1-1.7 2.3-2.6 3.9-2.6s2.9.9 3.9 2.6c-1 1.7-2.3 2.6-3.9 2.6s-2.9-.9-3.9-2.6Z"
      />
      <circle className="sidebar-svg-icon-node" cx="12" cy="11.2" r="1.25" />
      <path className="sidebar-svg-icon-spark" d="M12 4.7v1.8" />
    </>
  ),
  gateway: (
    <>
      <path d="M4.8 20V9.8a7.2 7.2 0 0 1 14.4 0V20" />
      <path d="M8 20V10.2a4 4 0 0 1 8 0V20" />
      <path
        className="sidebar-svg-icon-detail"
        d="M10 14.4h6.8M14 11.6l2.8 2.8-2.8 2.8"
      />
      <path
        className="sidebar-svg-icon-spark"
        d="M4.4 5.2 2.9 3.7M19.6 5.2l1.5-1.5"
      />
    </>
  ),
  settings: (
    <>
      <path d="M4.2 7h15.6M4.2 12h15.6M4.2 17h15.6" />
      <circle className="sidebar-svg-icon-node" cx="8.2" cy="7" r="1.7" />
      <circle className="sidebar-svg-icon-node" cx="15.8" cy="12" r="1.7" />
      <circle className="sidebar-svg-icon-node" cx="11.1" cy="17" r="1.7" />
    </>
  ),
};

export function SidebarSvgIcon({
  className,
  name,
  size = 18,
  title,
}: SidebarSvgIconProps): React.JSX.Element {
  const titleId = title
    ? `sidebar-svg-icon-${name}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    : undefined;

  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-labelledby={titleId}
      className={`sidebar-svg-icon sidebar-svg-icon--${name}${className ? ` ${className}` : ""}`}
      fill="none"
      focusable="false"
      height={size}
      role={title ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      {iconPaths[name]}
    </svg>
  );
}

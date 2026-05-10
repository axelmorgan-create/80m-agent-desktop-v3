import { FileUp } from "lucide-react";

export function ChatFileDropOverlay(): React.JSX.Element {
  return (
    <div className="file-drop-overlay" aria-hidden="true">
      <div className="file-drop-target">
        <FileUp size={28} />
        <span>Attach files</span>
      </div>
    </div>
  );
}

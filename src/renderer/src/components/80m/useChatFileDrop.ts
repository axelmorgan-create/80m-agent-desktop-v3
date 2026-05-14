import { useCallback, useRef, useState } from "react";
import type { Dispatch, DragEvent, SetStateAction } from "react";
import type { DroppedAttachment } from "./chatAreaTypes";
import {
  buildAttachmentDraft,
  fileUriToPath,
  hasDraggedFiles,
  pathBasename,
} from "./chatAreaUtils";

type ToastTone = "info" | "success" | "warning" | "error";

interface UseChatFileDropOptions {
  onAttachmentsAdded?: (attachments: DroppedAttachment[]) => void;
  setDraftInsert: Dispatch<
    SetStateAction<{
      id: string;
      text: string;
    } | null>
  >;
  showToast: (title: string, body: string, tone?: ToastTone) => void;
}

interface ChatFileDropHandlers {
  onDrop: (event: DragEvent) => void;
  onDragEnter: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
}

export function useChatFileDrop({
  onAttachmentsAdded,
  setDraftInsert,
  showToast,
}: UseChatFileDropOptions): {
  isDraggingFiles: boolean;
  dragHandlers: ChatFileDropHandlers;
} {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);

  const resolveDroppedFilePaths = useCallback(
    (dataTransfer: DataTransfer): string[] => {
      const paths = Array.from(dataTransfer.files || [])
        .map((file) => {
          return (
            window.hermesAPI?.getPathForFile?.(file) ||
            (file as File & { path?: string }).path ||
            ""
          );
        })
        .filter(Boolean);

      const uriPaths = dataTransfer
        .getData("text/uri-list")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map(fileUriToPath)
        .filter(Boolean);

      return [...new Set([...paths, ...uriPaths])];
    },
    [],
  );

  const handleDrop = useCallback(
    async (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
      if (!window.hermesAPI || !hasDraggedFiles(event.dataTransfer)) return;

      try {
        const paths = resolveDroppedFilePaths(event.dataTransfer);
        if (!paths.length) {
          showToast(
            "Drop failed",
            "Electron did not expose a local file path for this drop.",
            "error",
          );
          return;
        }

        const attachments: DroppedAttachment[] = [];
        for (const filePath of paths) {
          const destPath = await window.hermesAPI.copyFileToWorkspace(filePath);
          if (destPath) {
            let preview: {
              fileUrl?: string;
              kind?: DroppedAttachment["kind"];
              size?: number;
            } = {};
            try {
              const documentPreview =
                await window.hermesAPI.readDocumentPreview?.(destPath);
              if (documentPreview && typeof documentPreview === "object") {
                const record = documentPreview as {
                  fileUrl?: string;
                  kind?: DroppedAttachment["kind"];
                  size?: number;
                };
                preview = {
                  fileUrl: record.fileUrl,
                  kind: record.kind,
                  size: record.size,
                };
              }
            } catch {
              preview = {};
            }
            attachments.push({
              ...preview,
              name: pathBasename(destPath),
              path: destPath,
            });
          }
        }

        if (!attachments.length) {
          showToast(
            "Drop failed",
            "No files could be copied into Hermes.",
            "error",
          );
          return;
        }

        setDraftInsert({
          id: `drop-${Date.now()}-${attachments.length}`,
          text: buildAttachmentDraft(attachments),
        });
        onAttachmentsAdded?.(attachments);
        showToast(
          attachments.length === 1 ? "File attached" : "Files attached",
          "Dropped file paths were added to your draft.",
          "success",
        );
      } catch (err) {
        console.error("Failed to copy dropped file:", err);
        showToast("Drop failed", "The file could not be attached.", "error");
      }
    },
    [onAttachmentsAdded, resolveDroppedFilePaths, setDraftInsert, showToast],
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    if (!hasDraggedFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragEnter = useCallback((event: DragEvent) => {
    if (!hasDraggedFiles(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    if (!hasDraggedFiles(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFiles(false);
  }, []);

  return {
    isDraggingFiles,
    dragHandlers: {
      onDrop: handleDrop,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
    },
  };
}

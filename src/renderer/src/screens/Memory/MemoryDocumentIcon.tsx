import { BookOpen, Braces, FileCode2, FileJson, FileText } from "lucide-react";
import type { DocumentPreviewData } from "./memoryTypes";
import {
  documentExtension,
  isJsonDocument,
  isMarkdownDocument,
} from "./memoryUtils";

export function MemoryDocumentIcon({
  note,
}: {
  note: DocumentPreviewData;
}): React.JSX.Element {
  if (isMarkdownDocument(note)) return <BookOpen size={17} />;
  if (isJsonDocument(note)) return <FileJson size={17} />;
  if ([".yaml", ".yml"].includes(documentExtension(note))) {
    return <Braces size={17} />;
  }
  if (note.kind === "text") return <FileCode2 size={17} />;
  return <FileText size={17} />;
}

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
} from "react";
import {
  encodeJournalReference,
  JOURNAL_REF_PIXEL_STYLE,
  parseJournalContent,
  type JournalReferenceInsert,
  type JournalReferenceType,
} from "@/lib/journalReferences";

export type JournalEditorHandle = {
  insertReference: (ref: JournalReferenceInsert) => void;
  saveSelection: () => void;
  focus: () => void;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
};

function buildReferenceElement(type: JournalReferenceType, display: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.dataset.journalRef = type;
  span.dataset.refDisplay = display;
  span.contentEditable = "false";
  span.className = "journal-reference";
  Object.assign(span.style, JOURNAL_REF_PIXEL_STYLE as unknown as Record<string, string>);
  span.textContent = display;
  return span;
}

function serializeEditor(root: HTMLElement): string {
  let out = "";

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
    } else if (node instanceof HTMLElement && node.dataset.journalRef) {
      out += encodeJournalReference(
        node.dataset.journalRef as JournalReferenceType,
        node.dataset.refDisplay ?? node.textContent ?? "",
      );
    } else if (node instanceof HTMLElement) {
      if (node.tagName === "BR") {
        out += "\n";
      } else {
        out += serializeEditor(node);
      }
    }
  }

  return out;
}

function populateEditor(root: HTMLElement, value: string): void {
  root.innerHTML = "";

  const parts = parseJournalContent(value);
  if (parts.length === 0) return;

  for (const part of parts) {
    if (part.kind === "text") {
      const lines = part.value.split("\n");
      lines.forEach((line, index) => {
        if (line) root.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) root.appendChild(document.createElement("br"));
      });
    } else {
      root.appendChild(buildReferenceElement(part.type, part.display));
    }
  }
}

function getInsertRange(root: HTMLElement, savedRange: Range | null): Range {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && sel.anchorNode && root.contains(sel.anchorNode)) {
    return sel.getRangeAt(0).cloneRange();
  }
  if (savedRange && root.contains(savedRange.startContainer)) {
    return savedRange.cloneRange();
  }
  const range = document.createRange();
  if (root.childNodes.length === 0) {
    range.setStart(root, 0);
    range.collapse(true);
  } else {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  return range;
}

const JournalEditor = forwardRef<JournalEditorHandle, Props>(function JournalEditor(
  { value, onChange, placeholder, className, style },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const lastSerializedRef = useRef(value);
  const savedRangeRef = useRef<Range | null>(null);

  const saveSelection = useCallback(() => {
    const root = editorRef.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.rangeCount === 0) return;
    if (!sel.anchorNode || !root.contains(sel.anchorNode)) return;
    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  }, []);

  const emitChange = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;
    const serialized = serializeEditor(root);
    lastSerializedRef.current = serialized;
    onChange(serialized);
  }, [onChange]);

  const insertReference = useCallback(
    (reference: JournalReferenceInsert) => {
      const root = editorRef.current;
      if (!root) return;

      const span = buildReferenceElement(reference.type, reference.display);
      const trailingSpace = document.createTextNode(" ");
      const range = getInsertRange(root, savedRangeRef.current);

      range.deleteContents();
      range.insertNode(trailingSpace);
      range.insertNode(span);

      const caret = document.createRange();
      caret.setStartAfter(trailingSpace);
      caret.collapse(true);

      root.focus();
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(caret);
      savedRangeRef.current = caret.cloneRange();

      emitChange();
    },
    [emitChange],
  );

  useImperativeHandle(ref, () => ({
    insertReference,
    saveSelection,
    focus: () => editorRef.current?.focus(),
  }));

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;

    const onSelectionChange = () => saveSelection();
    document.addEventListener("selectionchange", onSelectionChange);
    root.addEventListener("keyup", saveSelection);
    root.addEventListener("mouseup", saveSelection);

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      root.removeEventListener("keyup", saveSelection);
      root.removeEventListener("mouseup", saveSelection);
    };
  }, [saveSelection]);

  useEffect(() => {
    const root = editorRef.current;
    if (!root || isComposingRef.current) return;
    if (value === lastSerializedRef.current) return;
    lastSerializedRef.current = value;
    populateEditor(root, value);
  }, [value]);

  const isEmpty = !value.trim();

  return (
    <div className="relative w-full" style={style}>
      {isEmpty && placeholder && (
        <div
          className="pointer-events-none absolute inset-0 text-white/40 select-none"
          style={{ fontFamily: "var(--font-body)", fontSize: "1rem", lineHeight: "2rem" }}
          aria-hidden
        >
          {placeholder}
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          if (!isComposingRef.current) emitChange();
        }}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
          emitChange();
        }}
        onBlur={saveSelection}
        className={className}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "1rem",
          lineHeight: "2rem",
          caretColor: "white",
          color: "white",
          outline: "none",
          minHeight: "100%",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
      />
    </div>
  );
});

export default JournalEditor;

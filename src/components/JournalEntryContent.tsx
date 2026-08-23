import { parseJournalContent, JOURNAL_REF_PIXEL_STYLE } from "@/lib/journalReferences";

type Props = {
  content: string;
  className?: string;
  bodyStyle?: React.CSSProperties;
};

/** Renders journal text with green pixel-font reference tags. */
export default function JournalEntryContent({ content, className, bodyStyle }: Props) {
  const parts = parseJournalContent(content);

  return (
    <p className={className} style={bodyStyle}>
      {parts.map((part, index) =>
        part.kind === "text" ? (
          <span key={index}>{part.value}</span>
        ) : (
          <span
            key={index}
            style={JOURNAL_REF_PIXEL_STYLE}
            className="journal-reference"
            title={part.type}
          >
            {part.display}
          </span>
        ),
      )}
    </p>
  );
}

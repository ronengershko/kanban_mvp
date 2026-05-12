import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";
import { isOverdue, isDueToday } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onEdit: (card: Card) => void;
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "text-red-600 bg-red-50 border-red-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  low: "text-sky-600 bg-sky-50 border-sky-200",
};

const formatDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const KanbanCard = ({ card, onDelete, onEdit }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dueDateColor = card.due_date
    ? isOverdue(card.due_date)
      ? "text-red-500"
      : isDueToday(card.due_date)
        ? "text-amber-500"
        : "text-[var(--gray-text)]"
    : "";

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative rounded-2xl border border-transparent bg-[var(--surface-card)] px-3 py-3 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150 cursor-pointer",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      {/* Delete button */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
        className="absolute right-2 top-2 rounded-full p-1 text-[var(--gray-text)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
        aria-label={`Delete ${card.title}`}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Edit button */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onEdit(card); }}
        className="absolute right-7 top-2 rounded-full p-1 text-[var(--gray-text)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
        aria-label={`Edit ${card.title}`}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M7 1l2 2-5.5 5.5H1.5V7L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        </svg>
      </button>

      <h4 className="pr-10 font-display text-sm font-semibold text-[var(--navy-dark)]">
        {card.title}
      </h4>
      <p className="mt-1.5 text-xs leading-5 text-[var(--gray-text)] line-clamp-2">
        {card.details}
      </p>

      {(card.priority || card.due_date) && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {card.priority && (
            <span
              className={clsx(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                PRIORITY_STYLES[card.priority]
              )}
            >
              {card.priority}
            </span>
          )}
          {card.due_date && (
            <span className={clsx("text-[10px] font-semibold", dueDateColor)}>
              {isOverdue(card.due_date) ? "Overdue · " : isDueToday(card.due_date) ? "Due today · " : ""}
              {formatDate(card.due_date)}
            </span>
          )}
        </div>
      )}
    </article>
  );
};

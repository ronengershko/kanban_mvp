"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Card, Priority } from "@/lib/kanban";

type CardDetailModalProps = {
  card: Card;
  columnTitle: string;
  onSave: (updated: Card) => void;
  onDelete: () => void;
  onClose: () => void;
};

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "high", label: "High", color: "text-red-600 bg-red-50 border-red-200" },
  { value: "medium", label: "Medium", color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "low", label: "Low", color: "text-sky-600 bg-sky-50 border-sky-200" },
];

export const CardDetailModal = ({
  card,
  columnTitle,
  onSave,
  onDelete,
  onClose,
}: CardDetailModalProps) => {
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [priority, setPriority] = useState<Priority | "">(card.priority ?? "");
  const [dueDate, setDueDate] = useState(card.due_date ?? "");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      ...card,
      title: title.trim(),
      details: details.trim(),
      priority: priority || undefined,
      due_date: dueDate || undefined,
    });
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-[var(--stroke)] bg-[var(--surface-card)] p-7 shadow-[0_32px_64px_rgba(3,33,71,0.18)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-[var(--gray-text)] hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          {columnTitle}
        </p>

        <form onSubmit={handleSubmit} className="mt-3 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]" htmlFor="card-title">
              Title
            </label>
            <input
              id="card-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 font-display text-lg font-semibold text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]" htmlFor="card-details">
              Details
            </label>
            <textarea
              id="card-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="mt-1 w-full resize-none rounded-xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
                Priority
              </label>
              <div className="mt-1 flex gap-1.5 flex-wrap">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(priority === p.value ? "" : p.value)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                      priority === p.value
                        ? p.color
                        : "border-[var(--stroke)] text-[var(--gray-text)] hover:border-[var(--navy-dark)]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]" htmlFor="card-due">
                Due Date
              </label>
              <input
                id="card-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => { onDelete(); onClose(); }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 3h8M5 3V2h2v1M4 3v6.5a.5.5 0 00.5.5h3a.5.5 0 00.5-.5V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Delete card
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[var(--stroke)] px-4 py-2 text-sm font-semibold text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[var(--secondary-purple)] px-5 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

import { useEffect } from "react";
import { AlertTriangle, Info, Trash2, X } from "lucide-react";

/** Shared, theme-aware replacement for native confirm()/alert() dialogs. */
function ActionDialog({
  open,
  title,
  message,
  variant = "danger",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
  busy = false,
  error = "",
}) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const isAlert = variant === "alert" || variant === "info";
  const isDanger = variant === "danger";
  const Icon = isAlert ? Info : isDanger ? Trash2 : AlertTriangle;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose?.();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="action-dialog-title"
        aria-describedby="action-dialog-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isAlert ? "bg-primary-50 text-primary-700" : isDanger ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
              <Icon size={21} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id="action-dialog-title" className="text-lg font-semibold text-heading">{title}</h2>
              <p id="action-dialog-description" className="mt-2 whitespace-pre-line text-sm leading-6 text-body">{message}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="-mr-1 -mt-1 rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-heading disabled:opacity-50"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border bg-slate-50/80 px-6 py-4">
          {!isAlert && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-body transition hover:bg-slate-100 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={isAlert ? onClose : onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${isAlert ? "bg-primary-600 hover:bg-primary-700" : isDanger ? "bg-red-600 hover:bg-red-700" : "bg-primary-600 hover:bg-primary-700"}`}
          >
            {busy ? "Please wait..." : isAlert ? "Got it" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ActionDialog;

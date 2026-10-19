import React from "react";
import { CheckCircle2, AlertOctagon, HelpCircle, RefreshCw } from "lucide-react";

export function EmptyState({
  title = "No Data Available",
  description = "No records matched your criteria.",
  type = "neutral", // "success", "danger", "neutral"
  onAction,
  actionLabel,
  icon,
}) {
  let DefaultIcon = HelpCircle;
  let iconClass = "empty-icon-neutral";

  if (type === "success") {
    DefaultIcon = CheckCircle2;
    iconClass = "empty-icon-success";
  } else if (type === "danger") {
    DefaultIcon = AlertOctagon;
    iconClass = "empty-icon-danger";
  }

  const RenderIcon = icon || DefaultIcon;

  return (
    <div className="empty-state-card">
      <div className={`empty-icon-wrap ${iconClass}`} aria-hidden="true">
        <RenderIcon size={32} />
      </div>
      <h4 className="empty-title">{title}</h4>
      <p className="empty-description">{description}</p>
      {onAction && actionLabel && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAction}>
          <RefreshCw size={14} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;

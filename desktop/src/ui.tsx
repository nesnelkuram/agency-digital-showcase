import { Task, TaskStatus } from "./types";
import { elapsedSeconds, formatClock } from "./timerService";

export function priorityColor(score?: number): string {
  if ((score ?? 0) >= 80) return "#ef4444";
  if ((score ?? 0) >= 50) return "#f59e0b";
  return "#10b981";
}

export function dueLabel(
  ms?: number
): { text: string; urgent: boolean } | null {
  if (!ms) return null;
  const diff = ms - Date.now();
  const overdue = diff < 0;
  const mins = Math.abs(diff) / 60000;
  let text: string;
  if (mins < 60) text = `${Math.round(mins)} dk`;
  else if (mins < 1440) text = `${Math.round(mins / 60)} sa`;
  else text = `${Math.round(mins / 1440)} gün`;
  return {
    text: overdue ? `${text} gecikti` : `${text} kaldı`,
    urgent: overdue || mins < 180,
  };
}

const STATUS_COLOR: Record<TaskStatus, string> = {
  open: "#6b7280",
  in_progress: "#10b981",
  paused: "#f59e0b",
  awaiting_review: "#6366f1",
  blocked: "#ef4444",
  completed: "#6b7280",
  cancelled: "#6b7280",
};

export function statusColor(s: TaskStatus): string {
  return STATUS_COLOR[s] ?? "#6b7280";
}

// Görev listesi satırı (popover + dashboard listesi).
export function TaskRow({
  task,
  selected,
  onClick,
}: {
  task: Task;
  selected?: boolean;
  onClick?: () => void;
}) {
  const due = dueLabel(task.dueDateMs);
  const running = task.status === "in_progress";
  const secs = elapsedSeconds(task);
  return (
    <div
      className={`task${selected ? " selected" : ""}${
        onClick ? " clickable" : ""
      }`}
      onClick={onClick}
    >
      <span
        className="dot"
        style={{ background: priorityColor(task.aiPriorityScore) }}
      />
      <div className="task-main">
        <div className="task-title">
          {task.flagged && <span className="flag">🚩</span>}
          {task.title}
        </div>
        <div className="task-meta">
          {task.projectName && <span>{task.projectName}</span>}
          {due ? (
            <span className={due.urgent ? "due urgent" : "due"}>{due.text}</span>
          ) : (
            <span className="due none">süresiz</span>
          )}
        </div>
      </div>
      {running ? (
        <span className="running-clock">{formatClock(secs)}</span>
      ) : (
        <span className="score">{task.aiPriorityScore ?? 0}</span>
      )}
    </div>
  );
}

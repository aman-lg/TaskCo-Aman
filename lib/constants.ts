export const STANDARD_DAILY_HOURS = 8;
export const STANDARD_DAILY_SECONDS = STANDARD_DAILY_HOURS * 3600;

export const IST_OFFSET_HOURS = 5.5;
export const IST_OFFSET_MS = IST_OFFSET_HOURS * 60 * 60 * 1000;

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const URGENCY_LEVELS = ["low", "medium", "high", "urgent"] as const;
export const PROJECT_STATUSES = ["active", "on_hold", "completed", "archived"] as const;

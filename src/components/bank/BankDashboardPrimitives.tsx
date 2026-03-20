/**
 * Small presentational pieces for BankDashboard (keeps main file smaller).
 */
import React from "react";

export function UrgencyBadge({ days }: { days: number | null }) {
  const bs = (bg: string, color: string) => ({
    background: bg,
    color,
    padding: "2px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
  });
  if (days === null) return <span style={bs("#f3f4f6", "#6b7280")}>No Date</span>;
  if (days < 0) return <span style={bs("#f3f4f6", "#9ca3af")}>Matured</span>;
  if (days === 0) return <span style={bs("#fef2f2", "#dc2626")}>TODAY!</span>;
  if (days <= 30) return <span style={bs("#fef2f2", "#dc2626")}>🔴 {days}d</span>;
  if (days <= 90) return <span style={bs("#fef9c3", "#ca8a04")}>🟡 {days}d</span>;
  if (days <= 180) return <span style={bs("#dcfce7", "#16a34a")}>🟢 {days}d</span>;
  return <span style={bs("#dbeafe", "#2563eb")}>{days}d</span>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 24px",
        background: "var(--color-card-bg-alt)",
        borderRadius: 12,
        border: "1px solid var(--color-card-border)",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.6 }}>{icon}</div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--color-text)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--color-text-muted)",
          marginBottom: action ? 16 : 0,
          maxWidth: 280,
          margin: "0 auto",
        }}
      >
        {description}
      </div>
      {action && onAction && (
        <button
          onClick={onAction}
          style={{
            background: "var(--color-primary)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 20px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            marginTop: 16,
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

/** CSS-variable theme map when not using ThemeContext runtime colors */
export const getThemeStyles = () => ({
  bg: "var(--color-background)",
  cardBg: "var(--color-card-bg)",
  cardBgAlt: "var(--color-card-bg-alt)",
  border: "var(--color-card-border)",
  borderLight: "var(--color-card-border)",
  text: "var(--color-text)",
  textMuted: "var(--color-text-muted)",
  textLight: "var(--color-text-light)",
  accent: "var(--color-primary)",
  accentHover: "var(--color-secondary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  headerBg:
    "linear-gradient(135deg, var(--gradient-from) 0%, var(--gradient-via) 50%, var(--gradient-to) 100%)",
});

export const inputSt: React.CSSProperties = {
  background: "var(--color-card-bg)",
  border: "1px solid var(--color-card-border)",
  color: "var(--color-text)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  width: "100%",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

export const labelSt: React.CSSProperties = {
  fontSize: 11,
  color: "var(--color-text-muted)",
  fontWeight: 600,
  display: "block",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Button({ className = "", variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button className={cx("ui-button", `ui-button-${variant}`, className)} {...props} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("ui-input", className)} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("ui-textarea", className)} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("ui-select", className)} {...props} />;
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" | "info" }) {
  return <span className={cx("ui-badge", `ui-badge-${tone}`)}>{children}</span>;
}

export function Alert({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("ui-alert", className)} role="alert">{children}</div>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("ui-card", className)}>{children}</div>;
}

export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="ui-section-header">
      <div>
        {eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {action ? <div className="ui-section-action">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="ui-empty-state">
      <div className="ui-empty-icon">⌕</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="ui-empty-action">{action}</div> : null}
    </div>
  );
}

export function Stack({ children, className = "" }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-stack", className)}>{children}</div>;
}

export function Grid({ children, className = "" }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-grid", className)}>{children}</div>;
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("ui-field", className)}>
      <span>{label}</span>
      {children}
    </label>
  );
}

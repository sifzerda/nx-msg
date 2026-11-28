// src/components/settings/SettingsSection.jsx

export default function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-start gap-3 border-b border-border p-4 sm:p-5">
        {Icon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-muted">
            <Icon size={21} aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm text-muted">
              {description}
            </p>
          )}
        </div>
      </header>

      <div className="p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}
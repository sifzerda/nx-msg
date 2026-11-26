// src/components/settings/SettingsSection.jsx

import { memo } from "react";

function SettingsSection({
    title,
    description,
    icon: Icon,
    children,
}) {
    return (
        <section className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/40">

            <header className="flex items-start gap-3 border-b border-gray-800 p-4 sm:p-5">

                {Icon && (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-gray-400">
                        <Icon size={21} />
                    </div>
                )}

                <div className="min-w-0 flex-1">

                    <h2 className="text-base font-semibold text-white">
                        {title}
                    </h2>

                    {description && (
                        <p className="mt-1 text-sm leading-relaxed text-gray-400">
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

export default memo(SettingsSection);
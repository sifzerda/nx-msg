// src/components/settings/SettingsNavigation.jsx

"use client";

import { memo } from "react";
import { ChevronRight } from "lucide-react";

import { SETTINGS_TABS } from "@/constants/settings";

function SettingsNavigation({
    activeTab,
    onChange,
}) {
    return (
        <nav
            aria-label="Settings navigation"
            className="min-w-0"
        >
            <div className="flex gap-2 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">

                {SETTINGS_TABS.map((tab) => {
                    const Icon = tab.icon;

                    const active =
                        activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onChange(tab.id)}
                            aria-current={
                                active ? "page" : undefined
                            }
                            className={[
                                "flex shrink-0 items-center gap-3",
                                "rounded-lg px-3 py-3",
                                "text-left text-sm font-medium",
                                "transition-colors",
                                "md:w-full",

                                active
                                    ? "bg-blue-600/15 text-blue-400"
                                    : "text-gray-400 hover:bg-gray-800 hover:text-white",
                            ].join(" ")}
                        >
                            <Icon
                                size={19}
                                className="shrink-0"
                            />

                            <span className="flex-1 whitespace-nowrap">
                                {tab.label}
                            </span>

                            {active && (
                                <ChevronRight
                                    size={16}
                                    className="hidden shrink-0 md:block"
                                />
                            )}

                        </button>
                    );
                })}

            </div>
        </nav>
    );
}

export default memo(SettingsNavigation);
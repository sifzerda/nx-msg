// src/components/settings/PrivacySettings.jsx

"use client";

import { ShieldBan, Info } from "lucide-react";

import SettingsSection from "./SettingsSection";
import BlockedUsersList from "./BlockedUsersList";

export default function PrivacySettings() {
    return (
        <div className="space-y-6">

            <header>
                <h1 className="text-xl font-semibold text-white">
                    Privacy & safety
                </h1>

                <p className="mt-1 text-sm text-gray-400">
                    Control how other users interact with you.
                </p>
            </header>

            <SettingsSection
                title="Blocked users"
                description="View and manage users you have blocked."
                icon={ShieldBan}
            >

                <div className="mb-5 flex items-start gap-3 rounded-lg border border-blue-900/40 bg-blue-950/20 p-4">

                    <Info
                        size={18}
                        className="mt-0.5 shrink-0 text-blue-400"
                    />

                    <div className="space-y-2 text-sm leading-relaxed text-gray-400">

                        <p>
                            Blocking a user prevents both of you
                            from sending private messages to
                            each other.
                        </p>

                        <p>
                            Existing message history and shared
                            group conversations are preserved.
                        </p>

                        <p>
                            You can unblock a user at any time.
                        </p>

                    </div>

                </div>

                <BlockedUsersList />

            </SettingsSection>

        </div>
    );
}
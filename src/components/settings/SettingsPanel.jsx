// src/components/settings/SettingsPanel.jsx

"use client";

import { useState } from "react";

import {
    Settings,
    UserRound,
    Palette,
} from "lucide-react";

import { SETTINGS_TAB } from "@/constants/settings";

import SettingsNavigation from "./SettingsNavigation";
import SettingsSection from "./SettingsSection";
import PrivacySettings from "./PrivacySettings";
import NotificationSettings from "./NotificationSettings";

/* -------------------- GENERAL -------------------- */

function GeneralSettings() {
    return (
        <SettingsSection
            title="General preferences"
            description="Manage your general application preferences."
            icon={Settings}
        >
            <p className="text-sm text-gray-500">
                No general preferences are available yet.
            </p>
        </SettingsSection>
    );
}

/* -------------------- ACCOUNT -------------------- */

function AccountSettings({ user }) {
    return (
        <SettingsSection
            title="Account information"
            description="View your account details."
            icon={UserRound}
        >
            <div className="space-y-4">

                <div>
                    <p className="text-xs font-medium text-gray-500">
                        Email address
                    </p>

                    <p className="mt-1 break-all text-sm text-gray-200">
                        {user?.email || "Unavailable"}
                    </p>
                </div>

            </div>
        </SettingsSection>
    );
}

/* -------------------- APPEARANCE -------------------- */

function AppearanceSettings() {
    return (
        <SettingsSection
            title="Appearance"
            description="Customise the appearance of Messenger."
            icon={Palette}
        >
            <p className="text-sm text-gray-500">
                Theme and colour preferences will be added here.
            </p>
        </SettingsSection>
    );
}

/* -------------------- COMPONENT MAP -------------------- */

const SETTINGS_COMPONENTS = Object.freeze({
    [SETTINGS_TAB.GENERAL]: GeneralSettings,
    [SETTINGS_TAB.ACCOUNT]: AccountSettings,
    [SETTINGS_TAB.PRIVACY]: PrivacySettings,
    [SETTINGS_TAB.NOTIFICATIONS]: NotificationSettings,
    [SETTINGS_TAB.APPEARANCE]: AppearanceSettings,
});

/* -------------------- MAIN PANEL -------------------- */

export default function SettingsPanel({ user }) {
    const [activeTab, setActiveTab] = useState(
        SETTINGS_TAB.PRIVACY
    );

    const ActiveComponent =
        SETTINGS_COMPONENTS[activeTab] ||
        GeneralSettings;

    return (
        <div className="grid min-w-0 gap-6 md:grid-cols-[210px_minmax(0,1fr)]">

            {/* Settings navigation */}

            <aside className="min-w-0 border-b border-gray-800 md:border-b-0 md:border-r md:pr-4">

                <SettingsNavigation
                    activeTab={activeTab}
                    onChange={setActiveTab}
                />

            </aside>

            {/* Active settings category */}

            <div className="min-w-0">

                <ActiveComponent user={user} />

            </div>

        </div>
    );
}
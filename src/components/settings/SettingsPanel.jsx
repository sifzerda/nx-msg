// src/components/settings/SettingsPanel.jsx

"use client";

import { useState } from "react";
import { Settings, UserRound } from "lucide-react";

import { SETTINGS_TAB } from "@/constants/settings";

import SettingsNavigation from "./SettingsNavigation";
import SettingsSection from "./SettingsSection";
import PrivacySettings from "./PrivacySettings";
import NotificationSettings from "./NotificationSettings";
import AppearanceSettings from "./AppearanceSettings";

function GeneralSettings() {
  return (
    <SettingsSection
      title="General preferences"
      description="Manage your general application preferences."
      icon={Settings}
    >
      <p className="text-sm text-muted">
        No general preferences are available yet.
      </p>
    </SettingsSection>
  );
}

function AccountSettings({ user }) {
  return (
    <SettingsSection
      title="Account information"
      description="View your account details."
      icon={UserRound}
    >
      <div>
        <p className="text-xs font-medium text-muted">
          Email address
        </p>

        <p className="mt-1 break-all text-sm text-foreground">
          {user?.email || "Unavailable"}
        </p>
      </div>
    </SettingsSection>
  );
}

const SETTINGS_COMPONENTS = {
  [SETTINGS_TAB.GENERAL]: GeneralSettings,
  [SETTINGS_TAB.ACCOUNT]: AccountSettings,
  [SETTINGS_TAB.PRIVACY]: PrivacySettings,
  [SETTINGS_TAB.NOTIFICATIONS]: NotificationSettings,
  [SETTINGS_TAB.APPEARANCE]: AppearanceSettings,
};

export default function SettingsPanel({ user }) {
  const [activeTab, setActiveTab] = useState(
    SETTINGS_TAB.PRIVACY
  );

  const ActiveComponent =
    SETTINGS_COMPONENTS[activeTab] || GeneralSettings;

  return (
    <div className="grid min-w-0 gap-6 md:grid-cols-[210px_minmax(0,1fr)]">
      <aside className="min-w-0 border-b border-border md:border-b-0 md:border-r md:pr-4">
        <SettingsNavigation
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </aside>

      <div className="min-w-0">
        <ActiveComponent user={user} />
      </div>
    </div>
  );
}
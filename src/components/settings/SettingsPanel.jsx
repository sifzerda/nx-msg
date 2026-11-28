// src/components/settings/SettingsPanel.jsx

"use client";

import { useState } from "react";

import {
  Settings,
  UserRound,
  Shield,
  Bell,
  Palette,
  ChevronRight,
} from "lucide-react";

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
      <p className="text-xs font-medium text-muted">
        Email address
      </p>

      <p className="mt-1 break-all text-sm text-foreground">
        {user?.email || "Unavailable"}
      </p>
    </SettingsSection>
  );
}

const TABS = [
  {
    id: "general",
    label: "General",
    icon: Settings,
    component: GeneralSettings,
  },
  {
    id: "account",
    label: "Account",
    icon: UserRound,
    component: AccountSettings,
  },
  {
    id: "privacy",
    label: "Privacy & safety",
    icon: Shield,
    component: PrivacySettings,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    component: NotificationSettings,
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    component: AppearanceSettings,
  },
];

function SettingsNavigation({ activeTab, onChange }) {
  return (
    <nav
      aria-label="Settings navigation"
      className="flex min-w-0 gap-2 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={active ? "page" : undefined}
            className={`
              flex shrink-0 items-center gap-3 rounded-lg
              px-3 py-3 text-left text-sm font-medium
              transition-colors md:w-full
              ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
              }
            `}
          >
            <Icon size={19} className="shrink-0" />

            <span className="flex-1 whitespace-nowrap">
              {label}
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
    </nav>
  );
}

export default function SettingsPanel({ user }) {
  const [activeTab, setActiveTab] = useState("privacy");

  const ActiveComponent =
    TABS.find((tab) => tab.id === activeTab)?.component
    ?? GeneralSettings;

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
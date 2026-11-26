// src/constants/settings.js

import {
    Settings,
    UserRound,
    Shield,
    Bell,
    Palette,
} from "lucide-react";

export const SETTINGS_TAB = Object.freeze({
    GENERAL: "general",
    ACCOUNT: "account",
    PRIVACY: "privacy",
    NOTIFICATIONS: "notifications",
    APPEARANCE: "appearance",
});

export const SETTINGS_TABS = Object.freeze([
    {
        id: SETTINGS_TAB.GENERAL,
        label: "General",
        icon: Settings,
    },
    {
        id: SETTINGS_TAB.ACCOUNT,
        label: "Account",
        icon: UserRound,
    },
    {
        id: SETTINGS_TAB.PRIVACY,
        label: "Privacy & safety",
        icon: Shield,
    },
    {
        id: SETTINGS_TAB.NOTIFICATIONS,
        label: "Notifications",
        icon: Bell,
    },
    {
        id: SETTINGS_TAB.APPEARANCE,
        label: "Appearance",
        icon: Palette,
    },
]);
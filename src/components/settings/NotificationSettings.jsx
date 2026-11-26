// src/components/settings/NotificationSettings.jsx

"use client";

import {
    BellRing,
    Volume2,
    Info,
} from "lucide-react";

import SettingsSection from "./SettingsSection";
import PushNotificationButton from "@/components/PushNotificationButton";

export default function NotificationSettings() {
    return (
        <div className="space-y-6">

            {/* Page heading */}

            <header>
                <h2 className="text-xl font-semibold text-white">
                    Notifications
                </h2>

                <p className="mt-1 text-sm text-gray-400">
                    Manage how you receive notifications.
                </p>
            </header>

            {/* Push notifications */}

            <SettingsSection
                title="Push notifications"
                description="Receive notifications for new messages."
                icon={BellRing}
            >
                <div className="space-y-4">

                    <p className="text-sm leading-relaxed text-gray-400">
                        Receive notifications when new messages arrive,
                        even when Messenger is minimised or not open,
                        provided your browser and device support
                        background notifications.
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-950/50 p-4">

                        <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-medium text-gray-200">
                                Message notifications
                            </h3>

                            <p className="mt-1 text-xs leading-relaxed text-gray-500">
                                Manage push notifications on this device.
                            </p>
                        </div>

                        <div className="shrink-0">
                            <PushNotificationButton />
                        </div>

                    </div>

                    {/* Browser permissions information */}

                    <div className="flex items-start gap-3 rounded-lg border border-blue-900/40 bg-blue-950/20 p-4">

                        <Info
                            size={18}
                            className="mt-0.5 shrink-0 text-blue-400"
                        />

                        <div className="space-y-2 text-xs leading-relaxed text-gray-400">

                            <p>
                                Your browser may ask for permission
                                before enabling notifications.
                            </p>

                            <p>
                                If notifications have been blocked
                                through your browser settings, you
                                may need to manually restore permission.
                            </p>

                        </div>

                    </div>

                </div>
            </SettingsSection>

            {/* Notification sounds */}

            <SettingsSection
                title="Notification sounds"
                description="Customise the sounds played when messages arrive."
                icon={Volume2}
            >
                <p className="text-sm text-gray-500">
                    Notification sound preferences will be
                    available in a future update.
                </p>
            </SettingsSection>

        </div>
    );
}
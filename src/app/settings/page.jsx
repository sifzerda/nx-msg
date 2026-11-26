// src/app/settings/page.jsx

import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SettingsPanel from "@/components/settings/SettingsPanel";
export const metadata = { title: "Settings | Messenger", description: "Manage your account and application preferences." };

export default async function SettingsPage() {
    const supabase = await createClient();

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    // Only pass the account information required
    // by the client component.

    const account = {
        id: user.id,
        email: user.email ?? null,
    };

    return (
        <div className="h-full min-w-0 overflow-y-auto bg-gray-950 px-4 py-6 text-white sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl space-y-6">

                {/* Page heading */}

                <header className="flex items-center gap-4 border-b border-gray-800 pb-6">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-800 bg-gray-900 text-gray-300">

                        <Settings size={26} />

                    </div>

                    <div className="min-w-0">

                        <h1 className="text-2xl font-semibold text-white">
                            Settings
                        </h1>

                        <p className="mt-1 text-sm text-gray-400">
                            Manage your account and application preferences.
                        </p>

                    </div>

                </header>

                {/* Settings panel */}

                <SettingsPanel
                    key={account.id}
                    user={account}
                />

            </div>

        </div>
    );
}
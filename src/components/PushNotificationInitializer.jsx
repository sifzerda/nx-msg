// src/components/PushNotificationInitializer.jsx

"use client";

import { useEffect } from "react";
import usePushStore from "@/store/usePushStore";

export default function PushNotificationInitializer({
    userId,
}) {
    const initialize = usePushStore(
        (state) => state.initialize
    );

    const reset = usePushStore(
        (state) => state.reset
    );

    useEffect(() => {
        if (!userId) {
            reset();
            return;
        }

        void initialize(userId);

    }, [
        userId,
        initialize,
        reset,
    ]);

    return null;
}
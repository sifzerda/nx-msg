// src/components/PushNotificationInitializer.jsx

"use client";

import { useEffect } from "react";
import usePushStore from "@/store/usePushStore";

export default function PushNotificationInitializer({ userId }) {
  useEffect(() => {
    const { initialize, reset } = usePushStore.getState();

    if (!userId) {
      reset();
      return;
    }

    void initialize(userId);
  }, [userId]);

  return null;
}
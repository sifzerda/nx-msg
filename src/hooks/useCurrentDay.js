// src/hooks/useCurrentDay.js

"use client";

import { useEffect, useState } from "react";
import { getDateKey } from "@/utils/messageUtils";

export default function useCurrentDay() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer;

    function scheduleUpdate() {
      clearTimeout(timer);

      const current = new Date();

      setNow((previous) =>
        getDateKey(previous) === getDateKey(current)
          ? previous
          : current
      );

      const midnight = new Date(current);

      midnight.setHours(24, 0, 0, 0);

      timer = setTimeout(
        scheduleUpdate,
        Math.max(
          100,
          midnight.getTime() - current.getTime() + 100
        )
      );
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        scheduleUpdate();
      }
    }

    scheduleUpdate();

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      clearTimeout(timer);

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, []);

  return now;
}

"use client";

import { create } from "zustand";
import { getPageVisible } from "@/hooks/useBrowser";

/* -------------------- CONFIGURATION -------------------- */

const STORAGE_KEY = "messenger:notification-sounds";

const MIN_SOUND_INTERVAL = 500;

const TONES = {
  chime: {
    label: "Chime",
    notes: [
      [660, 0, 0.15],
      [880, 0.12, 0.25],
    ],
  },

  pop: {
    label: "Pop",
    notes: [
      [520, 0, 0.08],
      [780, 0.06, 0.1],
    ],
  },

  digital: {
    label: "Digital",
    notes: [
      [880, 0, 0.07],
      [660, 0.09, 0.07],
      [1046, 0.18, 0.12],
    ],
  },

  bell: {
    label: "Soft bell",
    notes: [
      [523.25, 0, 0.4],
      [783.99, 0, 0.3],
    ],
  },

  double: {
    label: "Double beep",
    notes: [
      [740, 0, 0.12],
      [740, 0.18, 0.12],
    ],
  },
};

export const SOUND_OPTIONS = Object.entries(TONES).map(
  ([value, { label }]) => ({
    value,
    label,
  })
);

const DEFAULT_PREFERENCES = Object.freeze({
  enabled: true,
  tone: "chime",
  volume: 60,
  activeConversation: false,
  mentionsOnly: false,
});

/* -------------------- PREFERENCES -------------------- */

function sanitizePreferences(value = {}) {
  const preferences = value ?? {};

  return {
    enabled:
      typeof preferences.enabled === "boolean"
        ? preferences.enabled
        : DEFAULT_PREFERENCES.enabled,

    tone: Object.hasOwn(TONES, preferences.tone)
      ? preferences.tone
      : DEFAULT_PREFERENCES.tone,

    volume: Number.isFinite(preferences.volume)
      ? Math.round(
          Math.min(
            100,
            Math.max(0, preferences.volume)
          )
        )
      : DEFAULT_PREFERENCES.volume,

    activeConversation:
      preferences.activeConversation === true,

    mentionsOnly:
      preferences.mentionsOnly === true,
  };
}

function loadPreferences() {
  try {
    return sanitizePreferences(
      JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "{}"
      )
    );
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function savePreferences(preferences) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(preferences)
    );
  } catch {
    // Preferences remain available in memory.
  }
}

/* -------------------- STORE -------------------- */

export const useNotificationSoundStore = create(
  (set, get) => ({
    ...DEFAULT_PREFERENCES,

    hydrated: false,

    hydrate() {
      if (get().hydrated) return;

      set({
        ...loadPreferences(),
        hydrated: true,
      });
    },

    updatePreferences(preferences) {
      const current = get();

      const next = sanitizePreferences({
        ...current,
        ...preferences,
      });

      if (
        Object.keys(next).every(
          (key) => next[key] === current[key]
        )
      ) {
        return;
      }

      set(next);

      savePreferences(next);
    },

    resetPreferences() {
      get().updatePreferences(DEFAULT_PREFERENCES);
    },
  })
);

/* -------------------- AUDIO CONTEXT -------------------- */

let audioContext = null;
let lastSoundAt = -Infinity;
let resumeRequest = null;

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContext =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContext) return null;

  if (
    !audioContext ||
    audioContext.state === "closed"
  ) {
    audioContext = new AudioContext();
  }

  return audioContext;
}

function unlockAudio() {
  try {
    const context = getAudioContext();

    if (!context) {
      return Promise.resolve(false);
    }

    if (context.state === "running") {
      return Promise.resolve(true);
    }

    if (resumeRequest) {
      return resumeRequest;
    }

    resumeRequest = context
      .resume()
      .then(() => context.state === "running")
      .catch(() => false)
      .finally(() => {
        resumeRequest = null;
      });

    return resumeRequest;
  } catch {
    return Promise.resolve(false);
  }
}

/* -------------------- INITIALISATION -------------------- */

export function initializeNotificationSounds() {
  if (typeof window === "undefined") {
    return () => {};
  }

  useNotificationSoundStore.getState().hydrate();

  let active = true;

  function handleInteraction(event) {
    if (!active || !event.isTrusted) return;

    if (
      !useNotificationSoundStore.getState().enabled
    ) {
      return;
    }

    void unlockAudio();
  }

  function handleStorage(event) {
    if (
      event.key === STORAGE_KEY ||
      event.key === null
    ) {
      useNotificationSoundStore.setState(
        loadPreferences()
      );
    }
  }

  window.addEventListener(
    "pointerdown",
    handleInteraction,
    { passive: true }
  );

  window.addEventListener(
    "keydown",
    handleInteraction
  );

  window.addEventListener(
    "storage",
    handleStorage
  );

  return () => {
    active = false;

    window.removeEventListener(
      "pointerdown",
      handleInteraction
    );

    window.removeEventListener(
      "keydown",
      handleInteraction
    );

    window.removeEventListener(
      "storage",
      handleStorage
    );
  };
}

/* -------------------- TONE PLAYBACK -------------------- */

function playTone(context, tone, volume) {
  if (
    !context ||
    context.state !== "running" ||
    volume <= 0
  ) {
    return false;
  }

  const selected = TONES[tone] ?? TONES.chime;

  const startTime = context.currentTime + 0.01;

  // Keep notification tones at a comfortable level.
  const amplitude =
    (volume / 100) * 0.18 / selected.notes.length;

  for (const [
    frequency,
    offset,
    duration,
  ] of selected.notes) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    const start = startTime + offset;
    const end = start + duration;

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
      frequency,
      start
    );

    gain.gain.setValueAtTime(0, start);

    gain.gain.linearRampToValueAtTime(
      amplitude,
      start + 0.01
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      end
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };

    oscillator.start(start);
    oscillator.stop(end + 0.01);
  }

  return true;
}

/* -------------------- SOUND PREVIEW -------------------- */

export async function previewNotificationSound() {
  try {
    const unlocked = await unlockAudio();

    if (!unlocked) return false;

    const { tone, volume } =
      useNotificationSoundStore.getState();

    return playTone(
      audioContext,
      tone,
      volume
    );
  } catch {
    return false;
  }
}

/* -------------------- INCOMING MESSAGES -------------------- */

export function playIncomingMessageSound({
  message,
  userId,
  isActiveChat = false,
  isGroup = false,
}) {
  if (
    !message?.id ||
    !message.sender_id ||
    !userId ||
    message.sender_id === userId
  ) {
    return false;
  }

  const preferences =
    useNotificationSoundStore.getState();

  if (
    !preferences.hydrated ||
    !preferences.enabled ||
    preferences.volume === 0
  ) {
    return false;
  }

  // Background notifications are handled by Web Push.
  if (
    !getPageVisible() ||
    !document.hasFocus()
  ) {
    return false;
  }

  if (
    isActiveChat &&
    !preferences.activeConversation
  ) {
    return false;
  }

  if (
    isGroup &&
    preferences.mentionsOnly
  ) {
    const mentioned =
      Array.isArray(message.mentions) &&
      message.mentions.some(
        (mention) =>
          mention?.user_id === userId
      );

    if (!mentioned) {
      return false;
    }
  }

  // Do not queue sounds before the browser
  // has granted audio playback.
  if (
    !audioContext ||
    audioContext.state !== "running"
  ) {
    return false;
  }

  const now = Date.now();

  if (
    now - lastSoundAt < MIN_SOUND_INTERVAL
  ) {
    return false;
  }

  try {
    const played = playTone(
      audioContext,
      preferences.tone,
      preferences.volume
    );

    if (played) {
      lastSoundAt = now;
    }

    return played;
  } catch {
    // Audio failures must never interrupt messaging.
    return false;
  }
}
// src/utils/messageDates.js

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function getDateKey(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatMessageDate(value, now = new Date()) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateKey = getDateKey(date);

  if (dateKey === getDateKey(now)) {
    return "Today";
  }

  if (dateKey === getDateKey(yesterday)) {
    return "Yesterday";
  }

  return dateFormatter.format(date);
}

export function groupMessagesByDate(messages) {
  const groups = [];

  for (const message of messages) {
    const key = getDateKey(message.created_at);
    const previousGroup = groups[groups.length - 1];

    if (previousGroup?.key === key) {
      previousGroup.messages.push(message);
      continue;
    }

    groups.push({
      key,
      date: message.created_at,
      messages: [message],
    });
  }

  return groups;
}

// src/components/HighlightedText.jsx

"use client";

import { memo, useMemo } from "react";

function escapeRegExp(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function HighlightedText({
  text = "",
  query = "",
}) {
  const parts = useMemo(() => {
    const terms = [
      ...new Set(
        query
          .match(/[\p{L}\p{N}_]+/gu)
          ?.filter(
            (term) =>
              term.toUpperCase() !== "OR"
          ) ?? []
      ),
    ].sort(
      (a, b) => b.length - a.length
    );

    if (!terms.length) {
      return [text];
    }

    const pattern = terms
      .map(escapeRegExp)
      .join("|");

    const regex = new RegExp(
      `(${pattern})`,
      "gi"
    );

    return text.split(regex);
  }, [text, query]);

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            className="rounded-sm bg-yellow-500/30 text-yellow-100"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>
            {part}
          </span>
        )
      )}
    </>
  );
}

export default memo(HighlightedText);

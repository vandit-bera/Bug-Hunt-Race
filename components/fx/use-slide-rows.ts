"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Slides absolutely placed rows (`translateY(index * rowHeightRem)`) to their
 * new place when the order changes. Rows stay in rank order in the DOM, so
 * screen readers read 1st place first; React moves the elements, and moving
 * an element drops its CSS transition, so each moved row is put back at its
 * old place and then let go to slide to the new one. Give each row
 * `ref={rowRef(id)}`.
 */
export function useSlideRows(
  order: readonly string[],
  rowHeightRem: number,
  disabled: boolean,
) {
  const rows = useRef(new Map<string, HTMLElement>());
  const previous = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = new Map(order.map((id, index) => [id, index]));
    if (disabled) return;
    order.forEach((id, index) => {
      const from = before.get(id);
      const row = rows.current.get(id);
      if (from === undefined || from === index || !row) return;
      const to = row.style.transform;
      row.style.transition = "none";
      row.style.transform = `translateY(${from * rowHeightRem}rem)`;
      // Read layout so the browser starts from the old place.
      row.getBoundingClientRect();
      row.style.transition = "";
      row.style.transform = to;
    });
  });

  return useCallback(
    (id: string) => (row: HTMLElement | null) => {
      if (row) rows.current.set(id, row);
      else rows.current.delete(id);
    },
    [],
  );
}

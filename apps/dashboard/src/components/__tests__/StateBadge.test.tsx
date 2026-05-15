import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StateBadge } from "@/components/StateBadge";
import type { JobState } from "@/lib/types";

const STATES: JobState[] = ["QUEUED", "PROGRESS", "SUCCESS", "FAIL", "CANCELLED"];

describe("StateBadge", () => {
  for (const state of STATES) {
    it(`renders ${state}`, () => {
      const { container } = render(<StateBadge state={state} />);
      const el = screen.getByText(state);
      expect(el).toBeInTheDocument();
      // Verify the outer span carries a data-state attribute (state-machine awareness)
      const span = container.querySelector(`[data-state="${state}"]`);
      expect(span).toBeTruthy();
    });
  }
});

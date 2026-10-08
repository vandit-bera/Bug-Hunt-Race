import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Tooltip } from "./tooltip";

describe("Tooltip", () => {
  it("links the trigger to the tooltip", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Tip">
        <button>Go</button>
      </Tooltip>,
    );
    const tooltipId = /role="tooltip"/.test(html) && /id="([^"]+)"/.exec(html);
    expect(tooltipId).toBeTruthy();
    expect(html).toContain(
      `aria-describedby="${(tooltipId as RegExpExecArray)[1]}"`,
    );
  });

  it("keeps an existing aria-describedby on the child", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Tip">
        <button aria-describedby="hint">Go</button>
      </Tooltip>,
    );
    expect(html).toMatch(/aria-describedby="hint [^"]+"/);
  });
});

import { test, expect } from "@playwright/test";

test("inspect sign-in flicker", async ({ page }) => {
  const failures: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") failures.push(`[console.${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => failures.push(`[pageerror] ${err.message}`));

  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });

  // Snapshot at 0ms (right after DOMContentLoaded), 500ms, 1500ms, 3000ms
  const snapshots: { t: number; visibleText: string; opacity: string; childCount: number }[] = [];
  for (const t of [0, 200, 500, 1000, 2000, 3500]) {
    if (t > 0) await page.waitForTimeout(t - (snapshots.at(-1)?.t ?? 0));
    const result = await page.evaluate(() => {
      const body = document.body;
      const visibleText = body.innerText.trim().slice(0, 200);
      // Find any parent with opacity:0
      const style = (el: Element) => getComputedStyle(el).opacity;
      const all = Array.from(body.querySelectorAll("*"));
      const opacityZero = all.filter((e) => style(e) === "0").length;
      return {
        visibleText,
        opacityZero,
        childCount: all.length,
      };
    });
    snapshots.push({
      t,
      visibleText: result.visibleText,
      opacity: `${result.opacityZero} elements at opacity:0`,
      childCount: result.childCount,
    });
  }

  console.log("=== SNAPSHOTS ===");
  snapshots.forEach((s) =>
    console.log(`t=${s.t}ms | DOM nodes: ${s.childCount} | ${s.opacity} | text: ${JSON.stringify(s.visibleText)}`),
  );
  console.log("=== FAILURES ===");
  failures.forEach((f) => console.log(f));
  if (failures.length === 0) console.log("(no console/page errors)");

  // Always pass — this is a probe, not an assertion.
  expect(true).toBe(true);
});

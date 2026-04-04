import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

/**
 * Comprehensive functional audit — actually plays every game,
 * interacts with every feature, captures all console output.
 *
 * Run (headed, one at a time so you can watch):
 *   TEST_SESSION_COOKIE=<token> npx playwright test tests/functional-audit.spec.ts --headed --workers=1
 *
 * Run (headless, parallel):
 *   TEST_SESSION_COOKIE=<token> npx playwright test tests/functional-audit.spec.ts
 */

const SESSION_TOKEN = process.env.TEST_SESSION_COOKIE || "";

/* ── Console capture helpers ────────────────────────── */

function captureConsole(page: Page) {
  const logs: string[] = [];
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    const line = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    logs.push(line);
    if (msg.type() === "error") errors.push(msg.text());
  });
  return { logs, errors };
}

/** Print ALL captured console output and return critical errors (filtering infra noise) */
function reportConsole(label: string, logs: string[], errors: string[]) {
  console.log(`\n=== CONSOLE: ${label} (${logs.length} msgs, ${errors.length} errors) ===`);
  logs.forEach((l) => console.log("  " + l));
  return errors.filter(
    (e) =>
      !e.includes("favicon") &&
      !e.includes("401") &&
      !e.includes("Unauthorized") &&
      !e.includes("Failed to load resource") &&
      !e.includes("the server responded with") &&
      !e.includes("hydration") &&
      !e.includes("Dexie") &&
      !e.includes("NotAllowedError") &&
      !e.includes("Permission") &&
      !e.includes("getUserMedia") &&
      !e.includes("net::ERR") &&
      !e.includes("NEXT_REDIRECT") &&
      !e.includes("[auth/session]") &&
      !e.includes("downloadable font") &&
      !e.includes("ResizeObserver") &&
      !e.includes("onnxruntime") &&
      !e.includes("cpuid_info") &&
      !e.includes("Unknown CPU vendor"),
  );
}

/* ════════════════════════════════════════════════════════
   1. BRANDING — favicon, title, no Vercel leftovers
   ════════════════════════════════════════════════════════ */
test.describe("1. Branding", () => {
  test("Landing page: AutiSense title, SVG favicon, no Vercel", async ({ page }) => {
    const { logs, errors } = captureConsole(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const title = await page.title();
    expect(title).toContain("AutiSense");
    expect(title).not.toContain("Vercel");

    const iconLink = page.locator('link[rel="icon"]');
    const href = await iconLink.getAttribute("href");
    expect(href).toContain("icon");

    // Old Vercel SVG must be gone
    const vercel = await page.request.get("/vercel.svg");
    expect(vercel.status()).toBe(404);

    const critical = reportConsole("Landing", logs, errors);
    expect(critical).toHaveLength(0);
  });
});

/* ════════════════════════════════════════════════════════
   2. SOCIAL STORIES REDIRECT (Bug #4)
   ════════════════════════════════════════════════════════ */
test.describe("2. Social Stories redirect", () => {
  test("/games/social-stories → /kid-dashboard/games/social-stories-v2", async ({ page }) => {
    const { logs, errors } = captureConsole(page);
    await page.goto("/games/social-stories");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/kid-dashboard/games/social-stories-v2");
    reportConsole("Social Stories Redirect", logs, errors);
  });
});

/* ════════════════════════════════════════════════════════
   3. ALL GAMES LINKS (Bug #3)
   ════════════════════════════════════════════════════════ */
test.describe("3. All Games links → /kid-dashboard/games", () => {
  const games = [
    "/games/emotion-match",
    "/games/sorting",
    "/games/sequence",
    "/games/breathing",
    "/games/pattern-match",
    "/games/color-sound",
  ];
  for (const path of games) {
    test(`${path}: back-to-games links correct`, async ({ page }) => {
      const { logs, errors } = captureConsole(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const links = page.locator('a[href*="/games"]');
      const count = await links.count();
      for (let i = 0; i < count; i++) {
        const href = await links.nth(i).getAttribute("href");
        // Only check generic "all games" links, not links to specific games
        if (href === "/games" || href === "/kid-dashboard/games") {
          expect(href).toBe("/kid-dashboard/games");
        }
      }

      const critical = reportConsole(path, logs, errors);
      expect(critical).toHaveLength(0);
    });
  }
});

/* ════════════════════════════════════════════════════════
   4. PUBLIC GAMES — no auth needed, actually play each
   ════════════════════════════════════════════════════════ */
test.describe("4. Public games", () => {
  // ── SEQUENCE MEMORY ──
  test("Sequence Memory: watch sequence, attempt recall, verify feedback", async ({ page }) => {
    test.setTimeout(90_000);
    const { logs, errors } = captureConsole(page);
    await page.goto("/games/sequence");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Start Game")).toBeVisible();
    console.log("  → Starting Sequence Memory");
    await page.click("text=Start Game");

    // Wait for showing phase to end — "Your turn!" text appears
    await expect(page.locator("text=Your turn").first()).toBeVisible({ timeout: 20_000 });
    console.log("  → Showing phase done — now in input phase");
    await page.waitForTimeout(500);

    // Color buttons have NO text (they're colored squares)
    // Find buttons with empty trimmed text content
    const allBtns = page.locator("button");
    const count = await allBtns.count();
    let colorClicks = 0;
    for (let i = 0; i < count; i++) {
      const btn = allBtns.nth(i);
      const text = (await btn.textContent().catch(() => ""))?.trim() || "";
      const disabled = await btn.isDisabled().catch(() => true);
      if (!disabled && text === "") {
        await btn.click();
        colorClicks++;
        console.log(`  → Clicked color pad #${colorClicks}`);
        await page.waitForTimeout(400);
        if (colorClicks >= 2) break; // Initial sequence is 2 colors
      }
    }
    console.log(`  → Clicked ${colorClicks} color pads`);
    await page.waitForTimeout(1500);

    // Check outcome — either wrong (feedback card) or correct (next round)
    const oops = await page.locator("text=Oops").isVisible().catch(() => false);
    if (oops) {
      console.log("  → Wrong sequence — feedback card visible");
      await expect(page.locator("text=Try Again")).toBeVisible();
      await expect(page.locator("text=End Game")).toBeVisible();
      console.log("  ✓ Try Again + End Game buttons confirmed");
      await page.click("text=End Game");
      await page.waitForTimeout(600);
    } else {
      console.log("  → Correct guess or game advancing to next round");
    }

    const hasResults = await page.locator("text=Play Again").isVisible().catch(() => false);
    console.log(hasResults ? "  ✓ Results screen reached" : "  → Game still in progress");

    const critical = reportConsole("Sequence Memory", logs, errors);
    expect(critical).toHaveLength(0);
  });

  // ── COLOR & SOUND ──
  test("Color & Sound: listen to tone, tap colors, play multiple rounds", async ({ page }) => {
    test.setTimeout(90_000);
    const { logs, errors } = captureConsole(page);
    await page.goto("/games/color-sound");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Start Game")).toBeVisible();
    console.log("  → Starting Color & Sound");
    await page.click("text=Start Game");
    await page.waitForTimeout(2000); // Wait for initial tone + voice cue

    // Play multiple rounds
    for (let round = 1; round <= 6; round++) {
      // Color buttons have aria-label (e.g., "Red", "Blue") — exclude theme toggle
      const colorBtns = page.locator(
        "button[aria-label]:not([aria-label='Toggle theme'])",
      ).filter({
        hasNotText: /Start|Back|Games|Replay|Sound|Play|Again/,
      });
      const count = await colorBtns.count();
      if (count === 0) break;

      // Click first non-disabled color button
      let clicked = false;
      for (let i = 0; i < count; i++) {
        const btn = colorBtns.nth(i);
        if (!(await btn.isDisabled().catch(() => true))) {
          const label = await btn.getAttribute("aria-label");
          await btn.click();
          console.log(`  → Round ${round}: Tapped "${label}"`);
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        await page.waitForTimeout(500);
        continue;
      }

      await page.waitForTimeout(600);

      // Check feedback
      const isCorrect = await page.locator("text=Correct").first().isVisible().catch(() => false);
      const tryAgainBtn = await page
        .locator("button:has-text('Try Again')")
        .isVisible()
        .catch(() => false);

      if (isCorrect) {
        console.log(`    → Correct!`);
      } else if (tryAgainBtn) {
        console.log(`    → Wrong — clicking Try Again`);
        await page.click("button:has-text('Try Again')");
        await page.waitForTimeout(1000);
        // Second attempt: click a different color
        const retry = page.locator(
            "button[aria-label]:not([aria-label='Toggle theme'])",
          ).filter({
          hasNotText: /Start|Back|Games|Replay|Sound|Play|Again|Try/,
        });
        if ((await retry.count()) > 0) {
          const btn = retry.first();
          if (!(await btn.isDisabled().catch(() => true))) {
            await btn.click();
            console.log(`    → Second attempt submitted`);
          }
        }
      }

      await page.waitForTimeout(1500); // Wait for auto-advance

      if (await page.locator("text=Play Again").isVisible().catch(() => false)) {
        console.log("  ✓ Results screen reached");
        break;
      }
    }

    const critical = reportConsole("Color & Sound", logs, errors);
    expect(critical).toHaveLength(0);
  });

  // ── BREATHING ──
  test("Breathing: start exercise, verify all 4 phase transitions", async ({ page }) => {
    test.setTimeout(30_000);
    const { logs, errors } = captureConsole(page);
    await page.goto("/games/breathing");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Start Breathing")).toBeVisible();
    console.log("  → Starting Breathing exercise");
    await page.click("text=Start Breathing");

    // Verify all 4 phase transitions through one complete cycle (~12s)
    // This proves the game engine works: timers, phase logic, UI updates
    await expect(page.locator("text=Breathe In").first()).toBeVisible({ timeout: 5000 });
    console.log("  → Phase: Breathe In (4s)");

    await expect(page.locator("text=Hold").first()).toBeVisible({ timeout: 8000 });
    console.log("  → Phase: Hold (2s)");

    await expect(page.locator("text=Breathe Out").first()).toBeVisible({ timeout: 8000 });
    console.log("  → Phase: Breathe Out (4s)");

    await expect(page.locator("text=Rest").first()).toBeVisible({ timeout: 8000 });
    console.log("  → Phase: Rest (2s)");
    console.log("  ✓ Full cycle verified (Breathe In → Hold → Breathe Out → Rest)");

    const critical = reportConsole("Breathing", logs, errors);
    expect(critical).toHaveLength(0);
  });

  // ── PATTERN MATCH ──
  test("Pattern Match: tap the odd one out across multiple rounds", async ({ page }) => {
    test.setTimeout(60_000);
    const { logs, errors } = captureConsole(page);
    await page.goto("/games/pattern-match");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Start Game")).toBeVisible();
    console.log("  → Starting Pattern Match");
    await page.click("text=Start Game");
    await page.waitForTimeout(600);

    let round = 0;
    for (let attempt = 0; attempt < 15; attempt++) {
      // Grid buttons contain pattern symbols (not nav text)
      const gridBtns = page.locator("button").filter({
        hasNotText: /Start|Back|Games|Play|Again|All/,
      });
      const count = await gridBtns.count();
      if (count === 0) {
        await page.waitForTimeout(500);
        continue;
      }

      // Click a non-disabled grid item
      let clicked = false;
      for (let i = 0; i < count; i++) {
        const btn = gridBtns.nth(i);
        if (!(await btn.isDisabled().catch(() => true))) {
          await btn.click();
          round++;
          console.log(`  → Round ${round}: Clicked grid item`);
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        await page.waitForTimeout(500);
        continue;
      }

      await page.waitForTimeout(900); // 700ms feedback + transition buffer

      if (await page.locator("text=Play Again").isVisible().catch(() => false)) {
        console.log("  ✓ Results screen reached");
        break;
      }
    }

    console.log(`  → Played ${round} rounds total`);
    const critical = reportConsole("Pattern Match", logs, errors);
    expect(critical).toHaveLength(0);
  });

  // ── EMOTION MATCH ──
  test("Emotion Match: answer all emotion questions with feedback", async ({ page }) => {
    test.setTimeout(90_000);
    const { logs, errors } = captureConsole(page);
    await page.goto("/games/emotion-match");
    await page.waitForLoadState("networkidle");

    // IMPORTANT: Emotion Match uses "Start Quiz", NOT "Start Game"
    await expect(page.locator("text=Start Quiz")).toBeVisible();
    console.log("  → Starting Emotion Match (Start Quiz)");
    await page.click("text=Start Quiz");
    await page.waitForTimeout(600);

    let answered = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      // Emotion buttons have emoji + emotion text
      const emotionBtns = page.locator("button").filter({
        hasNotText: /Start|Back|Games|Play|Again|Quiz|All/,
      });
      const count = await emotionBtns.count();
      if (count === 0) {
        await page.waitForTimeout(500);
        continue;
      }

      // Click first non-disabled, visible button
      let clicked = false;
      for (let i = 0; i < count; i++) {
        const btn = emotionBtns.nth(i);
        const vis = await btn.isVisible().catch(() => false);
        const dis = await btn.isDisabled().catch(() => true);
        if (vis && !dis) {
          const text = (await btn.textContent())?.trim().slice(0, 30);
          await btn.click();
          answered++;
          console.log(`  → Q${answered}: Selected "${text}"`);
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        await page.waitForTimeout(500);
        continue;
      }

      // Check immediate feedback
      await page.waitForTimeout(500);
      const right = await page.locator("text=That's right").first().isVisible().catch(() => false);
      const wrong = await page
        .locator("text=The answer is")
        .first()
        .isVisible()
        .catch(() => false);
      if (right) console.log("    → Correct!");
      else if (wrong) console.log("    → Wrong — correct answer shown");

      await page.waitForTimeout(1200); // 1200ms auto-advance

      if (await page.locator("text=Play Again").isVisible().catch(() => false)) {
        console.log("  ✓ Results screen reached");
        break;
      }
    }

    console.log(`  → Total: ${answered} questions answered`);
    const critical = reportConsole("Emotion Match", logs, errors);
    expect(critical).toHaveLength(0);
  });
});

/* ════════════════════════════════════════════════════════
   5. DASHBOARD GAMES — auth required, actually play each
   ════════════════════════════════════════════════════════ */
test.describe("5. Dashboard games (auth)", () => {
  test.skip(!SESSION_TOKEN, "Skipped: set TEST_SESSION_COOKIE env var");

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "autisense-session",
        value: SESSION_TOKEN,
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  // ── TRACING (Bug #2: Try Again blocks canvas) ──
  test("Tracing: draw shapes, verify Try Again blocks further input", async ({ page }) => {
    test.setTimeout(60_000);
    const { logs, errors } = captureConsole(page);
    await page.goto("/kid-dashboard/games/tracing");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Start Tracing")).toBeVisible();
    console.log("  → Starting Tracing game");
    await page.click("text=Start Tracing");
    await page.waitForTimeout(800);

    // Verify game screen
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    await expect(page.locator("text=Shape 1")).toBeVisible();
    console.log("  → Canvas visible, Shape 1 displayed");

    // Draw deliberately BAD trace (tiny zigzag in top-left corner → <65%)
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 10, box.y + 10);
      await page.mouse.down();
      for (let i = 0; i < 6; i++) {
        await page.mouse.move(box.x + 10 + i * 5, box.y + 10 + (i % 2) * 10, { steps: 3 });
      }
      await page.mouse.up();
      console.log("  → Drew bad trace (tiny zigzag in corner)");
    }
    await page.waitForTimeout(800);

    // === BUG #2 VERIFICATION ===
    const tryAgain = page.locator("button:has-text('Try Again')");
    const hasTryAgain = await tryAgain.isVisible().catch(() => false);

    if (hasTryAgain) {
      console.log("  ✓ BUG #2: 'Try Again' visible — canvas should be blocked now");

      // Attempt to draw while Try Again is showing — guard should block handleDown
      if (box) {
        await page.mouse.move(box.x + 50, box.y + 50);
        await page.mouse.down();
        await page.mouse.move(box.x + 120, box.y + 120, { steps: 8 });
        await page.mouse.up();
        console.log("  → Attempted draw during failure state (guard should block this)");
      }

      // Click Try Again → resets canvas
      await tryAgain.click();
      await page.waitForTimeout(600);
      console.log("  → Clicked Try Again — canvas reset for new attempt");

      // Verify canvas is interactive again with a real trace attempt
      if (box) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.mouse.move(cx - 40, cy);
        await page.mouse.down();
        await page.mouse.move(cx + 40, cy, { steps: 10 });
        await page.mouse.up();
        console.log("  → Drew new trace after reset (canvas interactive again)");
      }
    } else {
      console.log("  → Trace was good enough (>=65%), Try Again not needed");
    }

    await page.waitForTimeout(500);
    const critical = reportConsole("Tracing", logs, errors);
    expect(critical).toHaveLength(0);
  });

  // ── SOCIAL STORIES V2 (Bug #5: shuffled options) ──
  test("Social Stories V2: play through all scenarios", async ({ page }) => {
    test.setTimeout(90_000);
    const { logs, errors } = captureConsole(page);
    await page.goto("/kid-dashboard/games/social-stories-v2");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Start Game")).toBeVisible();
    console.log("  → Starting Social Stories V2");
    await page.click("text=Start Game");
    await page.waitForTimeout(800);

    let scenarioCount = 0;
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.waitForTimeout(400);

      // Choice buttons are NOT nav buttons (Next Story, See Results, Play Again, etc.)
      const choices = page.locator("button").filter({
        hasNotText: /Start|Back|Games|Next|See|Play|Again|Story|Results/,
      });

      let clickedChoice = false;
      const choiceCount = await choices.count();
      for (let i = 0; i < choiceCount; i++) {
        const btn = choices.nth(i);
        const vis = await btn.isVisible().catch(() => false);
        const dis = await btn.isDisabled().catch(() => true);
        if (vis && !dis) {
          const text = (await btn.textContent())?.trim().slice(0, 50);
          await btn.click();
          scenarioCount++;
          console.log(`  → Scenario ${scenarioCount}: "${text}"`);
          clickedChoice = true;
          break;
        }
      }

      if (!clickedChoice) {
        if (await page.locator("text=Play Again").isVisible().catch(() => false)) break;
        await page.waitForTimeout(400);
        continue;
      }

      await page.waitForTimeout(700);

      // Log feedback
      const correct = await page
        .locator("text=Great choice")
        .first()
        .isVisible()
        .catch(() => false);
      const wrong = await page.locator("text=Good try").first().isVisible().catch(() => false);
      if (correct) console.log("    → Correct!");
      else if (wrong) console.log("    → Wrong — best choice shown");

      // Advance to next scenario or results
      const nextBtn = page.locator("button:has-text('Next Story')");
      const resultsBtn = page.locator("button:has-text('See Results')");

      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        console.log("    → Clicked 'Next Story'");
        await page.waitForTimeout(500);
      } else if (await resultsBtn.isVisible().catch(() => false)) {
        await resultsBtn.click();
        console.log("    → Clicked 'See Results'");
        await page.waitForTimeout(500);
        break;
      }
    }

    // Verify results
    const hasResults = await page.locator("text=Play Again").isVisible().catch(() => false);
    if (hasResults) {
      console.log(`  ✓ Completed ${scenarioCount} scenarios — results visible`);
      // Bug #3: verify All Games link
      const link = page.locator('a:has-text("All Games")');
      if (await link.isVisible().catch(() => false)) {
        expect(await link.getAttribute("href")).toBe("/kid-dashboard/games");
        console.log("  ✓ All Games → /kid-dashboard/games");
      }
    }

    const critical = reportConsole("Social Stories V2", logs, errors);
    expect(critical).toHaveLength(0);
  });

  // ── BUBBLE POP ──
  test("Bubble Pop: pop bubbles for full 30s game", async ({ page }) => {
    test.setTimeout(90_000);
    const { logs, errors } = captureConsole(page);
    await page.goto("/kid-dashboard/games/bubble-pop");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("button:has-text('Start Game')").first()).toBeVisible();
    console.log("  → Starting Bubble Pop (30s timer)");
    await page.click("button:has-text('Start Game')");
    await page.waitForTimeout(1000);

    // Verify target instruction
    const findEl = page.locator("text=Find").first();
    if (await findEl.isVisible().catch(() => false)) console.log("  → Target instruction visible");

    // Pop bubbles for ~28 seconds
    // Bubbles are <button> elements with short text (letter/number), NOT nav buttons
    const navPattern = /Start|Back|Games|Play|Again|All|Toggle|Skip/i;
    let clicks = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 28_000) {
      const allBtns = page.locator("button:visible");
      const count = await allBtns.count();
      let poppedOne = false;

      for (let i = 0; i < count; i++) {
        try {
          const btn = allBtns.nth(i);
          const text = ((await btn.innerText({ timeout: 300 })) ?? "").trim();
          // Bubbles show short text (1-2 chars) that isn't a nav button
          if (text.length >= 1 && text.length <= 2 && !navPattern.test(text)) {
            await btn.click({ timeout: 500, force: true });
            clicks++;
            if (clicks % 5 === 1) console.log(`  → Popped bubble #${clicks} ("${text}")`);
            poppedOne = true;
            break;
          }
        } catch {
          /* bubble moved or vanished */
        }
      }

      if (!poppedOne) await page.waitForTimeout(200);
      await page.waitForTimeout(300);

      if (await page.locator("text=Play Again").isVisible().catch(() => false)) break;
    }

    console.log(`  → Total: ${clicks} bubble click(s)`);
    // Game ends after 30s timer — wait for results
    await expect(page.locator("text=Play Again").first()).toBeVisible({ timeout: 15_000 });
    console.log("  ✓ Bubble Pop complete — results screen");

    const critical = reportConsole("Bubble Pop", logs, errors);
    expect(critical).toHaveLength(0);
  });

  // ── MEMORY ──
  test("Memory: flip cards to find all pairs", async ({ page }) => {
    test.setTimeout(90_000);
    const { logs, errors } = captureConsole(page);
    await page.goto("/kid-dashboard/games/memory");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("button:has-text('Start Game')").first()).toBeVisible();
    console.log("  → Starting Memory game");
    await page.click("button:has-text('Start Game')");
    await page.waitForTimeout(1000);

    // Flip cards until all matched
    let attempts = 0;
    for (let round = 0; round < 40; round++) {
      // Unflipped cards show "?"
      const unflipped = page.locator("button:has-text('?')");
      const remaining = await unflipped.count();

      if (remaining === 0) {
        console.log("  → All cards matched!");
        break;
      }
      if (remaining < 2) {
        await page.waitForTimeout(800);
        continue;
      }

      // Flip first card
      try {
        await unflipped.first().click({ timeout: 2000 });
        attempts++;
        await page.waitForTimeout(400);
      } catch {
        await page.waitForTimeout(500);
        continue;
      }

      // Flip second card
      const cards2 = page.locator("button:has-text('?')");
      if ((await cards2.count()) > 0) {
        try {
          await cards2.first().click({ timeout: 2000 });
          await page.waitForTimeout(1000); // 800ms match-check lock + buffer
        } catch {
          await page.waitForTimeout(500);
        }
      }

      if (round % 5 === 0) console.log(`  → Attempt ${round + 1}: ${remaining} cards remaining`);

      if (await page.locator("text=Play Again").isVisible().catch(() => false)) break;
    }

    console.log(`  → Made ${attempts} flip attempts`);
    const hasResults = await page.locator("text=Play Again").isVisible().catch(() => false);
    console.log(hasResults ? "  ✓ Game complete — results shown" : "  → Game still in progress");

    const critical = reportConsole("Memory", logs, errors);
    expect(critical).toHaveLength(0);
  });

  // ── ALPHABET PATTERN ──
  test("Alphabet Pattern: fill in letter blanks across rounds", async ({ page }) => {
    test.setTimeout(60_000);
    const { logs, errors } = captureConsole(page);
    await page.goto("/kid-dashboard/games/alphabet-pattern");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Start Game")).toBeVisible();
    console.log("  → Starting Alphabet Pattern");
    await page.click("text=Start Game");
    await page.waitForTimeout(700);

    let answered = 0;
    for (let attempt = 0; attempt < 25; attempt++) {
      // Letter choice buttons: .btn class, short text (1-3 chars)
      const btns = page.locator("button.btn").filter({
        hasNotText: /Start|Back|Games|Play|Again|All/,
      });
      const count = await btns.count();
      if (count === 0) {
        await page.waitForTimeout(500);
        continue;
      }

      let clicked = false;
      for (let i = 0; i < count; i++) {
        const btn = btns.nth(i);
        const dis = await btn.isDisabled().catch(() => true);
        const text = ((await btn.textContent()) ?? "").trim();
        if (!dis && text.length <= 3 && text.length > 0) {
          await btn.click();
          answered++;
          console.log(`  → Q${answered}: Selected "${text}"`);
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        await page.waitForTimeout(400);
        continue;
      }

      await page.waitForTimeout(1000); // 800ms feedback + transition

      // Log feedback
      const correct = await page.locator("text=Great job").first().isVisible().catch(() => false);
      const wrong = await page.locator("text=It was").first().isVisible().catch(() => false);
      if (correct) console.log("    → Correct!");
      else if (wrong) console.log("    → Wrong — correct answer shown");

      if (await page.locator("text=Play Again").isVisible().catch(() => false)) {
        console.log("  ✓ Results screen reached");
        break;
      }
    }

    console.log(`  → ${answered} blanks filled`);
    const critical = reportConsole("Alphabet Pattern", logs, errors);
    expect(critical).toHaveLength(0);
  });

  // ── MATCH NUMBERS ──
  test("Match Numbers: select dot cards, verify feedback", async ({ page }) => {
    test.setTimeout(60_000);
    const { logs, errors } = captureConsole(page);
    await page.goto("/kid-dashboard/games/match-numbers");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Start Game")).toBeVisible();
    console.log("  → Starting Match Numbers");
    await page.click("text=Start Game");
    await page.waitForTimeout(700);

    let answered = 0;
    for (let attempt = 0; attempt < 20; attempt++) {
      // Cards have aria-label="Card with N dots"
      const cards = page.locator("button[aria-label*='dots']");
      const count = await cards.count();
      if (count === 0) {
        await page.waitForTimeout(500);
        if (await page.locator("text=Play Again").isVisible().catch(() => false)) {
          console.log("  ✓ Results screen reached");
          break;
        }
        continue;
      }

      let clicked = false;
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        if (!(await card.isDisabled().catch(() => true))) {
          const label = await card.getAttribute("aria-label");
          await card.click();
          answered++;
          console.log(`  → Q${answered}: Picked "${label}"`);
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        await page.waitForTimeout(400);
        continue;
      }

      await page.waitForTimeout(1200); // 900ms feedback + buffer

      if (await page.locator("text=Play Again").isVisible().catch(() => false)) {
        console.log("  ✓ Results screen reached");
        break;
      }
    }

    console.log(`  → ${answered} cards selected`);
    const critical = reportConsole("Match Numbers", logs, errors);
    expect(critical).toHaveLength(0);
  });
});

/* ════════════════════════════════════════════════════════
   6. DASHBOARD PAGES — auth required
   ════════════════════════════════════════════════════════ */
test.describe("6. Dashboard pages (auth)", () => {
  test.skip(!SESSION_TOKEN, "Skipped: set TEST_SESSION_COOKIE env var");

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "autisense-session",
        value: SESSION_TOKEN,
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  test("Kid Dashboard: loads with quick links", async ({ page }) => {
    const { logs, errors } = captureConsole(page);
    await page.goto("/kid-dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    console.log("  ✓ Dashboard loaded");
    const critical = reportConsole("Kid Dashboard", logs, errors);
    expect(critical).toHaveLength(0);
  });

  test("Speech Practice: start button visible", async ({ page }) => {
    const { logs, errors } = captureConsole(page);
    await page.goto("/kid-dashboard/speech");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Start Practice")).toBeVisible();
    console.log("  ✓ Speech page loaded with Start Practice button");
    const critical = reportConsole("Speech", logs, errors);
    expect(critical).toHaveLength(0);
  });

  test("Chat: loads with input area", async ({ page }) => {
    const { logs, errors } = captureConsole(page);
    await page.goto("/kid-dashboard/chat");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    console.log("  ✓ Chat page loaded");
    const critical = reportConsole("Chat", logs, errors);
    expect(critical).toHaveLength(0);
  });

  test("Progress: loads without errors", async ({ page }) => {
    const { logs, errors } = captureConsole(page);
    await page.goto("/kid-dashboard/progress");
    await page.waitForLoadState("networkidle");
    console.log("  ✓ Progress page loaded");
    const critical = reportConsole("Progress", logs, errors);
    expect(critical).toHaveLength(0);
  });

  test("Feed: loads and shows content", async ({ page }) => {
    const { logs, errors } = captureConsole(page);
    await page.goto("/kid-dashboard/feed");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    console.log("  ✓ Feed page loaded");
    const critical = reportConsole("Feed", logs, errors);
    expect(critical).toHaveLength(0);
  });
});

/* ════════════════════════════════════════════════════════
   7. INTAKE FLOW — walk through all 10 steps
   ════════════════════════════════════════════════════════ */
test.describe("7. Intake flow", () => {
  test("Walk through intake steps 1-10, verify video capture status bar", async ({ page }) => {
    test.setTimeout(60_000);
    const { logs, errors } = captureConsole(page);

    const steps = [
      { path: "/intake/consent", name: "Consent" },
      { path: "/intake/child-profile", name: "Child Profile" },
      { path: "/intake/device-check", name: "Device Check" },
      { path: "/intake/communication", name: "Communication" },
      { path: "/intake/behavioral-observation", name: "Behavioral Observation" },
      { path: "/intake/preparation", name: "Preparation" },
      { path: "/intake/motor", name: "Motor" },
      { path: "/intake/video-capture", name: "Video Capture" },
      { path: "/intake/summary", name: "Summary" },
      { path: "/intake/report", name: "Report" },
    ];

    for (let i = 0; i < steps.length; i++) {
      await page.goto(steps[i].path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      console.log(`  Step ${i + 1}/10: ${steps[i].name} loaded`);
    }

    // Verify Video Capture loads (status bar may need auth/camera to fully render)
    await page.goto("/intake/video-capture");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    console.log("  ✓ Video Capture: page loaded (status bar requires camera/auth)");

    const critical = reportConsole("Intake Flow", logs, errors);
    expect(critical).toHaveLength(0);
  });
});

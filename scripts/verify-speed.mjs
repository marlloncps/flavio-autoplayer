import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const levels = (process.env.SPEED_TEST_MULTIPLIERS || '2,3').split(',').map(Number);
const reportPrefix = process.env.SPEED_REPORT_PREFIX || 'speed';
if (
  !levels.every((n) => Number.isFinite(n) && n >= 1 && n <= 20) ||
  !/^[a-z0-9-]+$/.test(reportPrefix)
)
  throw new Error('Configuração de teste inválida.');
const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  executablePath:
    process.env.BROWSER_PATH || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ignoreDefaultArgs: [
    '--unsafely-disable-devtools-self-xss-warnings',
    '--enable-unsafe-swiftshader',
  ],
  args: ['--mute-audio', '--disable-background-timer-throttling'],
});
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const bundle = await readFile(path.join(root, 'extension/bot.js'), 'utf8');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const load = async () => {
    await page.goto('https://cadeflavio.run/?debug', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__game);
    await page.addScriptTag({ content: bundle });
  };
  const panel = page.locator('#flavio-bot-panel');
  // Mede deslocamento real por teclas, com o piloto parado, em região inicial livre.
  const measurements = [];
  for (const multiplier of [1, 2]) {
    await load();
    await panel.locator(`[data-speed="${multiplier}"]`).click();
    await page.locator('#btn-start').click();
    await page.locator('#btn-confirm').click();
    const before = await page.evaluate(() => ({
      x: window.__game.player.x,
      t: performance.now(),
      gameTime: window.__game.gate.timer,
      speed: window.__game.player.speed,
    }));
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(600);
    await page.keyboard.up('ArrowRight');
    const after = await page.evaluate(() => ({
      x: window.__game.player.x,
      t: performance.now(),
      gameTime: window.__game.gate.timer,
      speed: window.__game.player.speed,
    }));
    measurements.push({
      multiplier,
      before,
      after,
      dx: after.x - before.x,
      elapsedMs: after.t - before.t,
      gameSeconds: after.gameTime - before.gameTime,
      unitsPerSecond: (after.x - before.x) / ((after.t - before.t) / 1000),
      unitsPerGameSecond: (after.x - before.x) / (after.gameTime - before.gameTime),
    });
    console.log(JSON.stringify({ measurement: measurements.at(-1) }));
  }
  const ratio = measurements[1].unitsPerSecond / measurements[0].unitsPerSecond;
  const gameRatio = measurements[1].unitsPerGameSecond / measurements[0].unitsPerGameSecond;
  // O motor limita o tempo por quadro. Compare a física por seu próprio relógio,
  // preservando a medição de tempo real como observação de desempenho.
  if (gameRatio < 1.9 || gameRatio > 2.1)
    throw new Error('Velocidade no motor não dobrou: ' + gameRatio);
  for (const multiplier of levels) {
    await load();
    const before = await page.evaluate(() => ({
      x: window.__game.player.x,
      y: window.__game.player.y,
      lives: window.__game.player.lives,
      speed: window.__game.player.speed,
    }));
    await panel.locator(`[data-speed="${multiplier}"]`).click();
    const after = await page.evaluate(() => ({
      x: window.__game.player.x,
      y: window.__game.player.y,
      lives: window.__game.player.lives,
      speed: window.__game.player.speed,
    }));
    if (
      after.speed !== before.speed * multiplier ||
      after.x !== before.x ||
      after.y !== before.y ||
      after.lives !== before.lives
    )
      throw new Error('Ajuste de velocidade alterou outro campo');
    await panel.locator('[data-speed="1"]').click();
    if ((await page.evaluate(() => window.__game.player.speed)) !== 245)
      throw new Error('Restauração falhou');
    await panel.locator(`[data-speed="${multiplier}"]`).click();
    const started = Date.now();
    await panel.getByRole('button', { name: 'Iniciar tentativa', exact: true }).click();
    await page.waitForFunction(
      () => window.__game.player.x > 1000 || window.__game.state !== 'playing',
    );
    if (multiplier === levels[0])
      await page.screenshot({ path: path.join(root, `reports/${reportPrefix}-preview.png`) });
    await page.waitForFunction(() => !window.__flavioBot.status.running, {}, { timeout: 125000 });
    const result = await page.evaluate(() => ({
      state: window.__game.state,
      lives: window.__game.player.lives,
      speed: window.__game.player.speed,
      progress: window.__flavioBot.status.progress,
      logSpeed: window.__flavioBot.logs.find((x) => x.type === 'decision')?.speed,
    }));
    results.push({ multiplier, ...result, durationMs: Date.now() - started });
    console.log(JSON.stringify(results.at(-1)));
    await panel.locator('[data-speed="1"]').click();
    if ((await page.evaluate(() => window.__game.player.speed)) !== 245)
      throw new Error('Restauração após partida falhou');
  }
  await load();
  const fresh = await page.evaluate(() => window.__game.player.speed);
  if (fresh !== 245 || errors.length)
    throw new Error('Falha após recarga ou erro de página: ' + errors.join(';'));
  const report = {
    date: new Date().toISOString(),
    measurements,
    observedSpeedRatio: ratio,
    gameSpeedRatio: gameRatio,
    resetVerified: true,
    reloadSpeed: fresh,
    results,
  };
  await writeFile(
    path.join(root, `reports/${reportPrefix}-validation.json`),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  if (results.some((r) => r.state !== 'cabin')) process.exitCode = 1;
} finally {
  await browser.close();
}

// A phone asleep overnight runs no timer: the app back on the screen the next
// morning still had yesterday as today for up to a minute, and 記一筆 logged
// breakfast under yesterday (proven 11-18: the clock moved on 9 hours, the
// app shown again, 記一筆 opened on 11-17 with 11-17 marked today).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.mjs', import.meta.url), 'utf8');

test('a new day is looked for the moment the app is back on the screen, and before 記一筆 opens', () => {
  assert.match(app, /function newDay\(\)/);
  assert.match(app, /addEventListener\('visibilitychange', \(\) => document\.visibilityState === 'visible' && newDay\(\)\)/);
  assert.match(app, /addEventListener\('pageshow', newDay\)/);
  const tap = app.slice(app.indexOf("label: W('記一筆'"), app.indexOf('openEntry({ day:'));
  assert.match(tap, /newDay\(\);/);
});

// 統計 left open on this month still showed November on 12-01 (proven 11-18:
// the clock moved on to 12-01 08:05, the app shown again, 2026年11月 stayed).
test('統計 on today’s period moves on with the day', () => {
  const body = app.slice(app.indexOf('function newDay()'), app.indexOf('setInterval(newDay'));
  assert.match(body, /if \(state\.at === lastDay\) state\.at = today\(\);/);
});

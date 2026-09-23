import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("login controls have stable accessible labels for browser and assistive technology", () => {
  const authForm = readFileSync("src/app/login/AuthForm.tsx", "utf8");

  assert.match(authForm, /<label htmlFor="email"[^>]*>\s*Email Address\s*<\/label>/);
  assert.match(authForm, /<input\s+id="email"\s+name="email"\s+type="email"/);
  assert.match(authForm, /<label htmlFor="password"[^>]*>\s*Password\s*<\/label>/);
  assert.match(authForm, /<input\s+id="password"\s+name="password"/);
});

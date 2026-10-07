import { test } from "node:test";
import assert from "node:assert/strict";
import { coverSourceRect, dragCoverPosition } from "../src/lib/cover-crop";

test("wide and tall cover images fill the book frame without blank edges", () => {
  const wide = coverSourceRect(1600, 900, { zoom: 1, x: 0.5, y: 0.5 });
  assert.ok(wide.sx > 0);
  assert.equal(wide.sy, 0);
  assert.ok(wide.sx + wide.width <= 1600);
  assert.ok(wide.sy + wide.height <= 900);
  const tall = coverSourceRect(900, 1600, { zoom: 1, x: 0.5, y: 0.5 });
  assert.equal(tall.sx, 0);
  assert.ok(tall.sy > 0);
  assert.ok(tall.sx + tall.width <= 900);
  assert.ok(tall.sy + tall.height <= 1600);
});

test("dragging and zooming keep the selected cover area inside the image", () => {
  const start = { zoom: 2, x: 0.5, y: 0.5 };
  const moved = dragCoverPosition(start, 30, -40, 400, 565, 1600, 900);
  assert.ok(moved.x < start.x);
  assert.ok(moved.y > start.y);
  const edge = dragCoverPosition(moved, -100000, 100000, 400, 565, 1600, 900);
  assert.equal(edge.x, 1);
  assert.equal(edge.y, 0);
  const rect = coverSourceRect(1600, 900, edge);
  assert.ok(rect.sx + rect.width <= 1600);
  assert.ok(rect.sy + rect.height <= 900);
});

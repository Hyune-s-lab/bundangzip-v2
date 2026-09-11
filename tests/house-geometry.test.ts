import { test } from "node:test";
import assert from "node:assert/strict";
import { rooms, createCommentSchema, floorplanVersion } from "../lib/model";
import {
  toWorld,
  toDrawing,
  buildWallParts,
  doors,
  slidingDoors,
  storageNiches,
  openSlidingPanels,
  windows,
} from "../lib/house-geometry";

test("3D room positions roundtrip to valid stored 2D comment coordinates", () => {
  for (const room of rooms) {
    const world = toWorld(...room.label),
      [x, y] = toDrawing(...world);
    assert.ok(Math.abs(x - room.label[0]) < 1e-9);
    assert.ok(Math.abs(y - room.label[1]) < 1e-9);
    assert.equal(
      createCommentSchema.safeParse({
        id: crypto.randomUUID(),
        authorId: "test",
        roomId: room.id,
        floorplanVersion,
        x: x / 923,
        y: y / 676,
        content: "3D position test",
      }).success,
      true,
      room.id,
    );
  }
  assert.equal(toWorld(702, 600)[0] - toWorld(193, 600)[0], 12.6);
  assert.equal(toWorld(702, 600)[1] - toWorld(702, 74)[1], 13.3);
});
test("all door openings remain unobstructed below their headers", () => {
  const parts = buildWallParts();
  for (const { opening: o } of [...doors, ...slidingDoors, ...storageNiches]) {
    const horizontal = o[1] === o[3],
      axis = horizontal ? 0 : 1,
      fixed = horizontal ? 1 : 0,
      mid = (o[axis] + o[axis + 2]) / 2;
    const covering = parts.filter(
      (p) =>
        p.segment[fixed] === o[fixed] &&
        p.segment[fixed + 2] === o[fixed] &&
        mid > Math.min(p.segment[axis], p.segment[axis + 2]) &&
        mid < Math.max(p.segment[axis], p.segment[axis + 2]),
    );
    assert.ok(covering.length > 0, JSON.stringify(o));
    assert.ok(
      covering.every((p) => p.bottom >= 2.05),
      JSON.stringify(o),
    );
  }
});
test("windows have sills and lintels but no wall across the glazing", () => {
  const parts = buildWallParts();
  for (const o of windows) {
    const mid = (o[0] + o[2]) / 2;
    const covering = parts.filter(
      (p) =>
        p.segment[1] === o[1] &&
        p.segment[3] === o[1] &&
        mid > Math.min(p.segment[0], p.segment[2]) &&
        mid < Math.max(p.segment[0], p.segment[2]),
    );
    assert.ok(covering.some((p) => p.bottom === 0 && p.top === 0.72));
    assert.ok(covering.some((p) => p.bottom === 2.12));
    assert.ok(covering.every((p) => p.top <= 0.72 || p.bottom >= 2.12));
  }
});

// Test actual 3D mesh extents, including wall thickness, rather than centerlines.
test("fully open sliding panels sit outside walls and leave the doorway clear", () => {
  const bounds = (segment: readonly number[], thickness: number) => {
    const a = toWorld(segment[0], segment[1]), b = toWorld(segment[2], segment[3]);
    return [Math.min(a[0], b[0]) - thickness / 2, Math.max(a[0], b[0]) + thickness / 2,
      Math.min(a[1], b[1]) - thickness / 2, Math.max(a[1], b[1]) + thickness / 2];
  };
  const walls = buildWallParts().filter((p) => p.bottom < 1 && p.top > 1);
  for (const door of slidingDoors.filter((d) => d.trackOffset)) {
    const axis = door.opening[1] === door.opening[3] ? 0 : 1;
    for (const panel of openSlidingPanels(door.opening, door)) {
      assert.ok(Math.max(panel[axis], panel[axis + 2]) <= door.opening[axis]);
      const p = bounds(panel, 0.065);
      for (const wall of walls) {
        const w = bounds(wall.segment, 0.125);
        const overlap = Math.min(p[1], w[1]) - Math.max(p[0], w[0]) > 0.001 &&
          Math.min(p[3], w[3]) - Math.max(p[2], w[2]) > 0.001;
        assert.equal(overlap, false, `${door.id}: panel buried in wall ${wall.segment}`);
      }
    }
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { furnishings, furnishingLabel } from "../lib/furnishings";
import {
  cutawayWallHeight,
  wallHeight,
  toWorld,
  slidingDoors,
  openSlidingPanels,
  doors,
  storageNiches,
} from "../lib/house-geometry";
import { rooms, containsPoint } from "../lib/model";

test("photo layout furniture stays within its assigned space for comment picking", () => {
  assert.equal(new Set(furnishings.map((f) => f.id)).size, furnishings.length);
  for (const item of furnishings) {
    const room = rooms.find((r) => r.id === item.roomId)!;
    assert.ok(room, item.id);
    const niche = storageNiches.find((n) => n.id === item.id);
    const footprintRoom = niche ? { ...room, points: niche.points } : room;
    assert.ok(
      containsPoint(footprintRoom, item.x + item.width / 2, item.y + item.depth / 2),
      `${item.id} anchor`,
    );
    // Appliances can overhang the open kitchen/dining boundary, but never a wall.
    const footprintRooms = ["kitchen", "dining"].includes(room.id)
      ? rooms.filter((r) => ["kitchen", "dining"].includes(r.id))
      : [footprintRoom];
    for (const [x, y] of [
      [item.x + 0.01, item.y + 0.01],
      [item.x + item.width - 0.01, item.y + 0.01],
      [item.x + 0.01, item.y + item.depth - 0.01],
      [item.x + item.width - 0.01, item.y + item.depth - 0.01],
    ])
      assert.ok(
        footprintRooms.some((r) => containsPoint(r, x, y)),
        `${item.id} outside ${room.id}: ${x}, ${y}`,
      );
  }
});
test("shifted room labels stay inside rooms, without changing stored anchors", () => {
  for (const room of rooms) {
    assert.ok(containsPoint(room, ...furnishingLabel(room, true)), room.id);
    assert.deepEqual(furnishingLabel(room, false), room.label);
  }
});

test("balcony passage stays clear of appliances and displayed door leaves", () => {
  const left = furnishings.find((f) => f.id === "kimchi-fridge")!;
  const right = furnishings.find((f) => f.id === "white-fridge")!;
  const minX = left.x + left.width,
    maxX = right.x;
  assert.ok(toWorld(maxX, 0)[0] - toWorld(minX, 0)[0] >= 0.6);
  const door = slidingDoors.find((d) => d.id === "balcony-dining")!;
  const opening = door.opening;
  assert.ok(opening[0] < minX && opening[2] > maxX);
  for (let x = minX + 0.5; x < maxX; x += 1)
    for (let y = 112; y < 200; y += 1) {
      assert.ok(
        rooms.some((r) => containsPoint(r, x, y)),
        `floor ${x},${y}`,
      );
      assert.ok(
        !furnishings.some(
          (f) => x > f.x && x < f.x + f.width && y > f.y && y < f.y + f.depth,
        ),
        `obstacle ${x},${y}`,
      );
    }
  for (const [ax, ay, bx, by] of [
    ...doors.map((d) => d.leaf),
    ...openSlidingPanels(opening, door),
  ]) {
    const intersects =
      Math.max(ax, bx) > minX &&
      Math.min(ax, bx) < maxX &&
      Math.max(ay, by) >= 112 &&
      Math.min(ay, by) <= 200;
    assert.equal(
      intersects,
      false,
      `door blocks passage: ${ax},${ay},${bx},${by}`,
    );
  }
});
test("both wall view heights reach at least the refrigerator tops", () => {
  const tallest = Math.max(
    ...furnishings.filter((f) => f.kind === "fridge").map((f) => f.height),
  );
  assert.ok(cutawayWallHeight >= tallest);
  assert.ok(wallHeight >= cutawayWallHeight);
});

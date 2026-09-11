import * as THREE from "three";
import { furnishings, type Furnishing } from "./furnishings";
import { toWorld } from "./house-geometry";
import type { Room } from "./model";

export function addFurnishings(
  scene: THREE.Scene,
  rooms: Room[],
  fullWalls: boolean,
  items: Furnishing[] = furnishings,
) {
  const material = (color: string, roughness = 0.65) =>
    new THREE.MeshStandardMaterial({ color, roughness });
  const cream = material("#ede8da"),
    metal = material("#7f8987", 0.32),
    dark = material("#303b3c", 0.3),
    top = material("#f0eee7", 0.35);
  for (const item of items) {
    const group = new THREE.Group();
    const [x, z] = toWorld(item.x + item.width / 2, item.y + item.depth / 2);
    group.position.set(x, item.elevation ?? 0, z);
    const side = item.facing === "west" || item.facing === "east";
    const worldW = (item.width * 12.6) / 509,
      worldD = (item.depth * 13.3) / 526;
    const w = side ? worldD : worldW,
      d = side ? worldW : worldD,
      h = item.height;
    group.rotation.y =
      item.facing === "west"
        ? -Math.PI / 2
        : item.facing === "east"
          ? Math.PI / 2
          : item.facing === "north"
            ? Math.PI
            : 0;
    const body = material(item.color);
    const mesh = (
      geometry: THREE.BufferGeometry,
      mat: THREE.Material,
      px: number,
      py: number,
      pz: number,
    ) => {
      const m = new THREE.Mesh(geometry, mat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.room = rooms.find((r) => r.id === item.roomId);
      m.userData.furnishingId = item.id;
      group.add(m);
      return m;
    };
    const box = (
      px: number,
      py: number,
      pz: number,
      bw: number,
      bh: number,
      bd: number,
      mat = body,
    ) => mesh(new THREE.BoxGeometry(bw, bh, bd), mat, px, py, pz);
    const legs = (height: number, inset = 0.055) => {
      for (const a of [-1, 1])
        for (const b of [-1, 1])
          box(
            a * (w / 2 - inset),
            height / 2,
            b * (d / 2 - inset),
            0.045,
            height,
            0.045,
          );
    };
    if (item.kind === "bed") {
      box(0, 0.19, 0, w, 0.3, d);
      box(0, 0.58, -d / 2 + 0.025, w + 0.015, 0.68, 0.06);
      box(0, 0.4, 0, w - 0.025, 0.2, d - 0.025, cream);
      box(0, 0.515, 0, w - 0.035, 0.03, d - 0.04, material("#b3bda0"));
      box(0, 0.565, -d * 0.33, w * 0.76, 0.1, d * 0.2, material("#dfded0"));
      box(0, 0.55, d * 0.15, w - 0.045, 0.06, d * 0.64, material("#939f9a"));
    } else if (item.kind === "desk") {
      legs(h - 0.04, 0.04);
      box(0, h, 0, w, 0.05, d);
      box(w * 0.34, h * 0.56, -d * 0.04, w * 0.28, h * 0.66, d * 0.8);
      for (let i = 0; i < 3; i++)
        box(
          w * 0.34,
          h * 0.33 + i * 0.15,
          d * 0.37,
          w * 0.2,
          0.012,
          0.015,
          metal,
        );
      // Chair is part of the desk group; small objects on the tabletop are omitted.
      box(-w * 0.12, 0.44, d / 2 + 0.14, 0.43, 0.07, 0.43, cream);
      box(-w * 0.12, 0.72, d / 2 + 0.32, 0.43, 0.51, 0.04, cream);
      box(
        -w * 0.12,
        0.72,
        d / 2 + 0.347,
        0.35,
        0.4,
        0.009,
        material("#b6b6ac"),
      );
      box(-w * 0.12, 0.22, d / 2 + 0.14, 0.045, 0.4, 0.045, metal);
      box(-w * 0.12, 0.035, d / 2 + 0.14, 0.4, 0.035, 0.4, cream);
    } else if (item.kind === "bookcase") {
      box(0, h / 2, -d / 2 + 0.015, w, h, 0.03);
      for (const sign of [-1, 1])
        box(sign * (w / 2 - 0.015), h / 2, 0, 0.03, h, d);
      box(0, h / 2, 0, 0.025, h, d);
      for (let row = 0; row <= 5; row++)
        box(0, 0.04 + (row * (h - 0.06)) / 5, 0, w, 0.025, d);
      const colors = ["#7b8b8a", "#b09772", "#617781", "#b9b09a", "#a6786b"];
      for (let row = 1; row < 5; row++)
        for (let col = 0; col < 6; col++) {
          const bookH = 0.2 + (col % 3) * 0.035;
          box(
            -w / 2 + 0.12 + (col * (w - 0.24)) / 6,
            0.065 + (row * (h - 0.06)) / 5 + bookH / 2,
            d * 0.06,
            0.04,
            bookH,
            d * 0.67,
            material(colors[(row + col) % colors.length]),
          );
        }
    } else if (item.kind === "wardrobe" || item.kind === "closet") {
      box(0, h / 2, 0, w, h, d);
      for (const sign of [-1, 1]) {
        box(
          (sign * w) / 4,
          h / 2,
          d / 2 + 0.012,
          w / 2 - 0.05,
          h - 0.14,
          0.025,
          material(item.kind === "closet" ? "#e8e1d4" : "#456e59"),
        );
        box(sign * 0.045, h * 0.46, d / 2 + 0.035, 0.025, 0.11, 0.035, body);
      }
      box(0, 0.11, d / 2 + 0.015, w - 0.07, 0.15, 0.03);
    } else if (item.kind === "cabinet") {
      box(0, h / 2, 0, w, h, d);
      for (let row = 0; row < 3; row++) {
        const centerY = (row + 0.5) * h / 3;
        box(0, centerY, d / 2 + 0.015, w - 0.05, h / 3 - 0.035, 0.035, body);
        box(0, centerY + 0.04, d / 2 + 0.045, w * 0.25, 0.025, 0.035, metal);
      }
    } else if (item.kind === "wall-air-conditioner") {
      box(0, h / 2, 0, w, h, d, cream);
      box(0, h * 0.7, d / 2 + 0.012, w - 0.07, h * 0.38, 0.025, top);
      box(0, h * 0.16, d / 2 + 0.02, w - 0.08, 0.045, 0.035, dark);
      for (let i = 0; i < 3; i++)
        box(0, h * 0.26 + i * 0.035, d / 2 + 0.025, w - 0.08, 0.008, 0.025, metal);
    } else if (item.kind === "table") {
      legs(h - 0.1, 0.08);
      box(0, h - 0.08, 0, w - 0.035, 0.13, d - 0.035);
      box(0, h, 0, w, 0.055, d, material("#b9b7a0", 0.2));
      // Wood border around the muted green glass tabletop in the photo.
      for (const sign of [-1, 1]) {
        box(sign * (w / 2 - 0.014), h + 0.01, 0, 0.028, 0.04, d);
        box(0, h + 0.01, sign * (d / 2 - 0.014), w, 0.04, 0.028);
      }
    } else if (item.kind === "tv") {
      box(0, 0.26, 0, w, 0.52, d);
      for (const sign of [-1, 1])
        box((sign * w) / 4, 0.29, d / 2 + 0.005, w / 2 - 0.015, 0.36, 0.02);
      const screenW = w * 0.85,
        screenH = 0.71;
      box(0, h - screenH / 2, 0, screenW, screenH, 0.055, dark);
      box(
        0,
        h - screenH / 2,
        0.031,
        screenW - 0.035,
        screenH - 0.035,
        0.008,
        material("#162830", 0.18),
      );
      for (const sign of [-1, 1])
        box(sign * screenW * 0.32, 0.55, 0.025, 0.035, 0.12, 0.2, dark);
    } else if (item.kind === "sofa") {
      const seatDepth = d,
        backZ = -d / 2 + 0.08,
        seatZ = -d / 2 + seatDepth / 2;
      box(0, 0.23, seatZ, w, 0.36, seatDepth);
      box(0, 0.65, backZ, w, 0.54, 0.18);
      for (const sign of [-1, 1])
        box(sign * (w / 2 - 0.08), 0.45, seatZ, 0.16, 0.44, seatDepth);
      const seatW = (w - 0.36) / 3;
      for (let i = 0; i < 3; i++) {
        const cx = -w / 2 + 0.18 + (i + 0.5) * seatW;
        box(
          cx,
          0.45,
          seatZ + 0.06,
          seatW - 0.02,
          0.13,
          seatDepth - 0.23,
          material("#504642"),
        );
        box(
          cx,
          0.7,
          backZ + 0.11,
          seatW - 0.02,
          0.34,
          0.14,
          material("#504642"),
        );
      }
    } else if (item.kind === "computer") {
      legs(0.71, 0.04);
      box(0, 0.74, 0, w, 0.045, d);
      box(0, 0.85, -d * 0.3, 0.025, 0.2, 0.03, dark);
      box(0, 1.05, -d * 0.3, Math.min(w * 0.75, 0.7), 0.43, 0.04, dark);
      box(
        0,
        1.05,
        -d * 0.3 + 0.025,
        Math.min(w * 0.75, 0.7) - 0.04,
        0.38,
        0.008,
        material("#3f5861", 0.3),
      );
      box(0, 0.775, d * 0.15, Math.min(w * 0.6, 0.5), 0.015, d * 0.2, dark);
      box(w * 0.4, 0.27, 0, 0.16, 0.48, 0.32, dark);
      box(0, 0.44, d / 2 + 0.15, 0.43, 0.1, 0.42, dark);
      box(0, 0.71, d / 2 + 0.33, 0.43, 0.49, 0.08, dark);
      box(0, 0.22, d / 2 + 0.15, 0.05, 0.39, 0.05, metal);
      box(0, 0.04, d / 2 + 0.15, 0.4, 0.04, 0.4, dark);
    } else if (item.kind === "air-conditioner") {
      box(0, h / 2, 0, w, h, d, cream);
      box(
        0,
        h * 0.81,
        d / 2 + 0.007,
        w - 0.05,
        h * 0.25,
        0.015,
        material("#bcc8c5", 0.25),
      );
      for (let i = 0; i < 4; i++)
        box(
          0,
          h * 0.71 + i * 0.035,
          d / 2 + 0.02,
          w - 0.065,
          0.008,
          0.015,
          metal,
        );
      box(w * 0.22, h * 0.57, d / 2 + 0.015, 0.04, 0.04, 0.015, dark);
    } else if (item.kind === "chair") {
      legs(0.44, 0.028);
      box(0, 0.46, 0, w, 0.07, d, material("#b2a58a"));
      for (const sign of [-1, 1])
        box(sign * (w / 2 - 0.025), 0.71, -d / 2 + 0.024, 0.036, 0.48, 0.036);
      box(0, 0.9, -d / 2 + 0.024, w, 0.07, 0.035);
      for (const offset of [-0.065, 0.065])
        box(offset, 0.72, -d / 2 + 0.024, 0.025, 0.3, 0.032);
    } else if (item.kind === "fridge") {
      box(0, h / 2, 0, w, h, d);
      const four = item.id === "main-fridge";
      if (four) {
        for (const sign of [-1, 1])
          for (const row of [0, 1])
            box(
              (sign * w) / 4,
              row === 0 ? h * 0.19 : h * 0.69,
              d / 2 + 0.012,
              w / 2 - 0.013,
              row === 0 ? h * 0.37 : h * 0.59,
              0.025,
            );
        box(0, h * 0.39, d / 2 + 0.03, w - 0.025, 0.035, 0.018, dark);
        box(0, h * 0.7, d / 2 + 0.03, 0.012, h * 0.59, 0.02, dark);
      } else {
        box(0, h / 2, d / 2 + 0.012, w - 0.025, h - 0.04, 0.025, cream);
        box(-w * 0.35, h * 0.63, d / 2 + 0.045, 0.025, 0.3, 0.045, metal);
        box(0, h - 0.08, d / 2 + 0.03, w - 0.04, 0.035, 0.022, dark);
      }
    } else if (item.kind === "washer") {
      box(0, h / 2, 0, w, h, d);
      box(0, h - 0.08, d / 2 + 0.012, w - 0.025, 0.12, 0.025, cream);
      box(w * 0.2, h - 0.08, d / 2 + 0.03, w * 0.23, 0.045, 0.016, dark);
      const ring = mesh(
        new THREE.TorusGeometry(w * 0.31, 0.032, 12, 40),
        metal,
        0,
        h * 0.43,
        d / 2 + 0.022,
      );
      ring.castShadow = false;
      const drum = mesh(
        new THREE.CylinderGeometry(w * 0.265, w * 0.265, 0.025, 40),
        dark,
        0,
        h * 0.43,
        d / 2 + 0.023,
      );
      drum.rotation.x = Math.PI / 2;
      mesh(
        new THREE.TorusGeometry(w * 0.225, 0.012, 8, 32),
        material("#718b8b", 0.15),
        0,
        h * 0.43,
        d / 2 + 0.04,
      );
    } else if (item.kind === "kimchi-fridge") {
      box(0, h / 2, 0, w, h, d);
      for (const sign of [-1, 1]) {
        box((sign * w) / 4, h, 0, w / 2 - 0.014, 0.045, d, cream);
        box((sign * w) / 4, h + 0.035, d * 0.3, w * 0.22, 0.025, 0.035, metal);
      }
      box(0, h * 0.86, d / 2 + 0.01, w * 0.35, 0.06, 0.016, dark);
    } else if (item.kind === "counter") {
      box(0, h / 2, 0, w, h - 0.05, d);
      box(0, h, 0, w + 0.025, 0.05, d + 0.025, top);
      const n = Math.max(1, Math.round(w / 0.5));
      for (let i = 0; i < n; i++) {
        const cx = -w / 2 + ((i + 0.5) * w) / n;
        box(cx, h / 2, d / 2 + 0.006, w / n - 0.012, h - 0.09, 0.015, cream);
        box(cx, h - 0.1, d / 2 + 0.025, (w / n) * 0.65, 0.015, 0.02, metal);
      }
      if (fullWalls && item.id === "back-counter") {
        box(0, 1.97, -d * 0.25, w, 0.62, d * 0.52, cream);
        for (let i = 1; i < n; i++)
          box(-w / 2 + (i * w) / n, 1.97, 0.02, 0.008, 0.6, 0.01, metal);
      }
    } else if (item.kind === "sink") {
      box(0, h, 0, w, 0.015, d, metal);
      box(0, h + 0.01, 0, w - 0.07, 0.015, d - 0.06, material("#a8bfba", 0.2));
      const faucet = mesh(
        new THREE.TorusGeometry(0.09, 0.014, 8, 20, Math.PI),
        metal,
        0,
        h + 0.14,
        -d / 2 + 0.05,
      );
      faucet.rotation.y = Math.PI / 2;
      box(0, h + 0.08, -d / 2 + 0.05, 0.025, 0.16, 0.025, metal);
    } else if (item.kind === "hob") {
      box(0, h, 0, w, 0.022, d, dark);
      for (const a of [-1, 1])
        for (const b of [-1, 1]) {
          const ring = mesh(
            new THREE.TorusGeometry(0.066, 0.012, 8, 20),
            metal,
            a * w * 0.25,
            h + 0.022,
            b * d * 0.24,
          );
          ring.rotation.x = -Math.PI / 2;
        }
    }
    scene.add(group);
  }
}

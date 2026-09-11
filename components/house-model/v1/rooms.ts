import type { Room } from "@/lib/model";

export const kitchenDiningBoundaryY = 171;
export const rooms: Room[] = [
  {
    "id": "bedroom-nw",
    "name": "침실 1",
    "kind": "bedroom",
    "points": "231,146 380,146 380,288 231,288",
    "label": [
      305,
      207
    ],
    "area": "13.85"
  },
  {
    "id": "bedroom-ne",
    "name": "침실 2",
    "kind": "bedroom",
    "points": "581,147 702,147 702,269 581,269",
    "label": [
      642,
      207
    ],
    "area": "15.64"
  },
  {
    "id": "bedroom-sw",
    "name": "침실 3",
    "kind": "bedroom",
    "points": "193,374 380,374 380,538 193,538",
    "label": [
      284,
      448
    ],
    "area": "18.91"
  },
  {
    "id": "bedroom-se",
    "name": "침실 4",
    "kind": "bedroom",
    "points": "578,374 702,374 702,538 578,538",
    "label": [
      640,
      448
    ],
    "area": "12.30"
  },
  {
    "id": "bathroom-west",
    "name": "화장실 1",
    "kind": "bathroom",
    "points": "193,289 274,289 274,374 193,374",
    "label": [
      233,
      340
    ]
  },
  {
    "id": "bathroom-east",
    "name": "화장실 2",
    "kind": "bathroom",
    "points": "508,215 582,215 582,306 508,306",
    "label": [
      545,
      274
    ]
  },
  {
    "id": "kitchen",
    "name": "주방",
    "kind": "kitchen",
    "points": "441,74 581,74 581,171 441,171",
    "label": [
      496,
      160
    ]
  },
  {
    "id": "dining",
    "name": "식당",
    "kind": "dining",
    "points": "380,146 441,146 441,171 581,171 581,198 508,198 508,289 380,289",
    "label": [
      444,
      240
    ]
  },
  {
    "id": "living",
    "name": "거실",
    "kind": "living",
    "points": "274,289 508,289 508,306 582,306 582,271 629,271 629,374 578,374 578,538 380,538 380,374 274,374",
    "label": [
      483,
      435
    ],
    "area": "33.98"
  },
  {
    "id": "balcony-nw",
    "name": "발코니 1",
    "kind": "balcony",
    "points": "232,91 379,91 379,74 418,74 418,105 441,105 441,146 232,146",
    "label": [
      331,
      120
    ]
  },
  {
    "id": "balcony-ne",
    "name": "발코니 2",
    "kind": "balcony",
    "points": "581,86 702,86 702,147 581,147",
    "label": [
      642,
      117
    ]
  },
  {
    "id": "balcony-south",
    "name": "발코니 3",
    "kind": "balcony",
    "points": "193,538 702,538 702,600 193,600",
    "label": [
      447,
      572
    ]
  },
  {
    "id": "entrance",
    "name": "현관",
    "kind": "entrance",
    "points": "629,305 702,305 702,374 629,374",
    "label": [
      665,
      344
    ]
  }
];

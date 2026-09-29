import React from "react";
import { C } from "../theme";

/** The entities the deck's ontology links. Shared so the graph can reappear later, smaller. */
export const NODES = [
  { k: "Company", x: 960, y: 566, r: 30, hub: true },
  { k: "Asset", x: 960, y: 322, r: 19 },
  { k: "Person", x: 668, y: 406, r: 19 },
  { k: "Filing", x: 1252, y: 406, r: 19 },
  { k: "Regulation", x: 486, y: 590, r: 19 },
  { k: "Claim", x: 1434, y: 590, r: 19 },
  { k: "Contract", x: 660, y: 762, r: 19 },
  { k: "Event", x: 1260, y: 762, r: 19 },
];

export const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [0, 7],
  [2, 6],
  [3, 4],
  [7, 1],
  [5, 7],
];

/** natural centre of the layout above */
export const GRAPH_C = { x: 960, y: 542 };

/**
 * The assembled graph, drawn at any size. Used full-frame when it is built,
 * then again shrunk down so the next shot can put it inside the customer's boundary.
 */
export const GraphStatic: React.FC<{
  cx: number;
  cy: number;
  scale: number;
  opacity?: number;
}> = ({ cx, cy, scale, opacity = 1 }) => {
  const tx = (x: number) => cx + (x - GRAPH_C.x) * scale;
  const ty = (y: number) => cy + (y - GRAPH_C.y) * scale;

  return (
    <svg
      width={1920}
      height={1080}
      style={{ position: "absolute", left: 0, top: 0, opacity, pointerEvents: "none" }}
    >
      {EDGES.map(([a, b], i) => (
        <line
          key={`e${i}`}
          x1={tx(NODES[a].x)}
          y1={ty(NODES[a].y)}
          x2={tx(NODES[b].x)}
          y2={ty(NODES[b].y)}
          stroke="rgba(96,165,250,0.42)"
          strokeWidth={Math.max(1, 1.6 * scale)}
        />
      ))}
      {NODES.map((nd) => (
        <circle
          key={nd.k}
          cx={tx(nd.x)}
          cy={ty(nd.y)}
          r={nd.r * scale}
          fill={nd.hub ? C.brand : C.brandLite}
        />
      ))}
    </svg>
  );
};

export interface Point {
  x: number
  y: number
}

/** Four corners of a detected/adjusted document, ordered top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point]

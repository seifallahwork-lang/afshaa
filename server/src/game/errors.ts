import type { ErrorCode } from "../../../shared/protocol";

/** A rule violation the client should be told about (wrong phase, double vote, ...). */
export class GameError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code);
  }
}

import type { ClientMessage, RoomView } from "@shared/protocol";

export interface ScreenProps {
  state: RoomView;
  send: (msg: ClientMessage) => void;
  clockOffset: number;
  onLeave: () => void;
}

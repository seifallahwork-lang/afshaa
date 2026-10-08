import { useCountdown } from "../hooks/useCountdown";
import { t } from "../i18n/ar";
import type { ScreenProps } from "./types";

export function CountdownScreen({ state, clockOffset }: ScreenProps) {
  const left = useCountdown(state.phaseEndsAt, clockOffset);
  return (
    <div className="countdown">
      <p className="countdown-round">{t.roundOf(state.round, state.totalRounds)}</p>
      <div className="countdown-num" key={left}>
        {Math.max(1, left)}
      </div>
      <p className="countdown-sub">{t.getReady}</p>
    </div>
  );
}

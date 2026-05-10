import React from "react";

interface AtmMascotMotionStyleProps {
  isIntro: boolean;
}

export function AtmMascotMotionStyle({
  isIntro,
}: AtmMascotMotionStyleProps): React.JSX.Element {
  return (
    <style>{`
      .atm-character { animation: master-hover 4.5s ease-in-out infinite; animation-delay: ${isIntro ? "2.8s" : "0s"}; transform-origin: center; }
      .atm-shadow { transform-origin: 400px 920px; animation: shadow-pulse 4.5s ease-in-out infinite; opacity: ${isIntro ? "0" : "1"}; transition: opacity 1s ease-out 2.4s; }
      .wing-left-container { transform-origin: 220px 450px; animation: flutter-left 0.12s ease-in-out infinite alternate; }
      .wing-right-container { transform-origin: 580px 450px; animation: flutter-right 0.12s ease-in-out infinite alternate; }
      .eye-anim { transform-origin: center; transform-box: fill-box; animation: blink 5s infinite; }
      .anim-sleep .sleep-zzz-1 { animation: zzz-float 3s linear infinite; }
      .anim-sleep .sleep-zzz-2 { animation: zzz-float 3s linear infinite 1s; }
      .anim-searching .scan-line { animation: scan-line-anim 1.5s linear infinite alternate; }
      .anim-typing .atm-character { animation: typing-bounce 0.15s infinite; }
      .anim-error .atm-character { animation: shake-anim 0.2s infinite; }
      .anim-jump .atm-character { animation: jump-anim 1s cubic-bezier(0.28, 0.84, 0.42, 1); }
      .anim-jackpot .dollar-bill { animation: bill-rain 0.3s linear infinite; }
      .anim-lobster .pincer-move { animation: claw-snap 0.2s infinite; }
      .anim-urgent .atm-character { animation: shake-anim 0.1s infinite; }
      .anim-default .top-light-glow { animation: top-light-breathe 2.8s ease-in-out infinite; }
      .anim-processing .eye-anim { animation: look-around 2s ease-in-out infinite; }
      .anim-processing .top-light-glow, .anim-processing .top-light-glow rect { fill: #4ade80; filter: drop-shadow(0 0 10px #4ade80); animation: flash-gold 0.4s infinite alternate; }
    `}</style>
  );
}

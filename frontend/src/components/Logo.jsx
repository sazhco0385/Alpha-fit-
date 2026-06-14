import { Zap } from "lucide-react";

export default function Logo({ size = 40, withText = true }) {
  return (
    <div className="flex items-center gap-3" data-testid="alphafit-logo">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Outer shield glow */}
        <div
          className="absolute inset-0 hex-shield"
          style={{
            background:
              "linear-gradient(180deg, #00E5FF 0%, #1E90FF 100%)",
            boxShadow: "0 0 25px rgba(0,191,255,0.7), 0 0 50px rgba(0,191,255,0.3)",
          }}
        />
        {/* Inner black shield */}
        <div
          className="absolute inset-[3px] hex-shield"
          style={{ background: "#000" }}
        />
        {/* Lightning A */}
        <Zap
          size={size * 0.55}
          strokeWidth={2.5}
          className="relative z-10 text-[#00BFFF]"
          style={{ filter: "drop-shadow(0 0 8px rgba(0,191,255,0.9))" }}
        />
      </div>
      {withText && (
        <div className="leading-none">
          <div className="font-teko text-2xl font-bold tracking-widest">
            <span className="chrome-text">ALPHA</span>
            <span className="electric-text glow-text">FIT</span>
          </div>
        </div>
      )}
    </div>
  );
}

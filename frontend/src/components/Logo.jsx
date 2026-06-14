export default function Logo({ size = 40, withText = true, square = false }) {
  // For "square" usage (favicons/big hero), show the full logo image
  // For inline usage, we show the logo image scaled - the black square outer rim blends with our black app background
  if (square) {
    return (
      <img
        src="/alphafit-logo.png"
        alt="alpha-fit"
        style={{ width: size, height: size, objectFit: "contain" }}
        data-testid="alphafit-logo"
      />
    );
  }
  return (
    <div className="flex items-center gap-2" data-testid="alphafit-logo">
      <img
        src="/alphafit-logo.png"
        alt="alpha-fit"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          filter: "drop-shadow(0 0 8px rgba(0,191,255,0.6))",
        }}
      />
      {withText && (
        <div className="leading-none">
          <div className="font-teko text-xl sm:text-2xl font-bold tracking-widest">
            <span className="chrome-text">ALPHA</span>
            <span className="electric-text glow-text">FIT</span>
          </div>
        </div>
      )}
    </div>
  );
}

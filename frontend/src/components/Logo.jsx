export default function Logo({ size = 40, withText = true, square = false }) {
  // For "square" usage (favicons/big hero), show the full logo image (with text)
  if (square) {
    return (
      <img
        src="/alphafit-logo.png?v=4"
        alt="alpha-fit"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          filter: "drop-shadow(0 0 12px rgba(0,191,255,0.6))",
        }}
        data-testid="alphafit-logo"
      />
    );
  }
  return (
    <div className="flex items-center gap-2" data-testid="alphafit-logo">
      <img
        src="/alphafit-helmet.png?v=4"
        alt="alpha-fit"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          filter: "drop-shadow(0 0 12px rgba(0,191,255,0.65))",
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

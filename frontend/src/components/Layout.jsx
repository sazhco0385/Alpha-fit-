import { NavLink, useNavigate } from "react-router-dom";
import { Home, Dumbbell, Brain, TrendingUp, Crown, Shield, LogOut } from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "../lib/auth";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: "/dashboard", icon: Home, label: "Start", testid: "nav-dashboard" },
    { to: "/plan", icon: Dumbbell, label: "Plan", testid: "nav-plan" },
    { to: "/coach", icon: Brain, label: "Coach", testid: "nav-coach" },
    { to: "/progress", icon: TrendingUp, label: "Stats", testid: "nav-progress" },
    { to: "/premium", icon: Crown, label: "Pro", testid: "nav-premium" },
  ];
  if (user?.is_admin) navItems.push({ to: "/admin", icon: Shield, label: "Admin", testid: "nav-admin" });

  const cols = navItems.length;

  return (
    <div className="min-h-screen bg-black text-white relative">
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-40" />
      <div className="fixed inset-0 bg-radial-blue pointer-events-none" />

      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/70 border-b border-[#1A1A24]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
          <button onClick={() => navigate("/dashboard")} className="flex items-center min-w-0" data-testid="header-logo-btn">
            <Logo size={32} />
          </button>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {user?.is_premium && (
              <span className="inline-flex items-center gap-1 px-2 py-1 border border-[#00BFFF] text-[#00BFFF] font-teko tracking-widest text-xs sm:text-sm glow-box" data-testid="premium-badge">
                <Crown size={12} /> <span className="hidden sm:inline">PREMIUM</span><span className="sm:hidden">PRO</span>
              </span>
            )}
            <button onClick={() => { logout(); navigate("/"); }} className="text-gray-400 hover:text-[#00BFFF] transition w-11 h-11 flex items-center justify-center" data-testid="logout-btn" aria-label="Logout">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-4 sm:py-6 pb-32">{children}</main>

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 md:px-8 pb-28 pt-6 flex flex-wrap justify-center gap-3 sm:gap-6 text-[9px] sm:text-[10px] tracking-widest uppercase text-gray-600 font-chakra">
        <NavLink to="/impressum" className="hover:text-[#00BFFF]" data-testid="layout-impressum-link">Impressum</NavLink>
        <NavLink to="/agb" className="hover:text-[#00BFFF]" data-testid="layout-agb-link">AGB</NavLink>
        <NavLink to="/datenschutz" className="hover:text-[#00BFFF]" data-testid="layout-datenschutz-link">Datenschutz</NavLink>
        <span className="w-full sm:w-auto text-center">© Sky-Networks UG</span>
      </div>

      {/* Bottom nav */}
      <nav translate="no" className="notranslate fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl bg-black/90 border-t border-[#1A1A24] pb-[env(safe-area-inset-bottom)]" data-testid="bottom-nav">
        <div
          className="max-w-7xl mx-auto md:flex md:justify-center md:gap-12"
          style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              data-testid={it.testid}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-3 px-1 min-h-[56px] transition-all min-w-0 ${
                  isActive
                    ? "text-[#00E5FF] glow-text-soft"
                    : "text-gray-500 hover:text-[#00BFFF] active:text-[#00E5FF]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <it.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="font-teko text-[10px] sm:text-xs tracking-wider truncate w-full text-center">{it.label.toUpperCase()}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

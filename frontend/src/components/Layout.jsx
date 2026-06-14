import { NavLink, useNavigate } from "react-router-dom";
import { Home, Dumbbell, Brain, TrendingUp, Crown, Shield, LogOut, User } from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "../lib/auth";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: "/dashboard", icon: Home, label: "Home", testid: "nav-dashboard" },
    { to: "/plan", icon: Dumbbell, label: "Plan", testid: "nav-plan" },
    { to: "/coach", icon: Brain, label: "Coach", testid: "nav-coach" },
    { to: "/progress", icon: TrendingUp, label: "Progress", testid: "nav-progress" },
    { to: "/premium", icon: Crown, label: "Premium", testid: "nav-premium" },
  ];
  if (user?.is_admin) navItems.push({ to: "/admin", icon: Shield, label: "Admin", testid: "nav-admin" });

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Subtle grid background */}
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-40" />
      <div className="fixed inset-0 bg-radial-blue pointer-events-none" />

      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/70 border-b border-[#1A1A24]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/dashboard")} className="flex items-center" data-testid="header-logo-btn">
            <Logo size={36} />
          </button>
          <div className="flex items-center gap-3">
            {user?.is_premium && (
              <span className="hidden md:inline-flex items-center gap-1 px-3 py-1 border border-[#00BFFF] text-[#00BFFF] font-teko tracking-widest text-sm glow-box" data-testid="premium-badge">
                <Crown size={14} /> PREMIUM
              </span>
            )}
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400 font-chakra">
              <User size={16} className="text-[#00BFFF]" /> {user?.name}
            </div>
            <button onClick={() => { logout(); navigate("/"); }} className="text-gray-400 hover:text-[#00BFFF] transition" data-testid="logout-btn">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-6 pb-28">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl bg-black/85 border-t border-[#1A1A24]" data-testid="bottom-nav">
        <div className="max-w-7xl mx-auto grid grid-cols-6 md:flex md:justify-center md:gap-12">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              data-testid={it.testid}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-3 transition-all ${
                  isActive
                    ? "text-[#00E5FF] glow-text-soft"
                    : "text-gray-500 hover:text-[#00BFFF]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <it.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="font-teko text-xs tracking-widest">{it.label.toUpperCase()}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

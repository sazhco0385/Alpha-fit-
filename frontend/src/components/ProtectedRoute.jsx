import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function ProtectedRoute({ children, requireOnboarding = true, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-[#00BFFF] font-teko text-3xl tracking-widest glow-text">
        LADE...
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (adminOnly && !user.is_admin) return <Navigate to="/dashboard" replace />;
  if (requireOnboarding && !user.onboarding_completed && !user.is_admin) return <Navigate to="/onboarding" replace />;
  return children;
}

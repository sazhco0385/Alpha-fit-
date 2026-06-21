import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./lib/auth";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Coach from "./pages/Coach";
import PlanView from "./pages/PlanView";
import ActiveWorkout from "./pages/ActiveWorkout";
import Progress from "./pages/Progress";
import Premium from "./pages/Premium";
import PaymentReturn from "./pages/PaymentReturn";
import Admin from "./pages/Admin";
import { Impressum, AGB, Datenschutz } from "./pages/Legal";
import Support from "./pages/Support";
import Nutrition from "./pages/Nutrition";
import BodyScan from "./pages/BodyScan";
import Library, { LibraryDetail } from "./pages/Library";
import FormCheck from "./pages/FormCheck";
import Settings from "./pages/Settings";
import Unsubscribe from "./pages/Unsubscribe";
import Friends from "./pages/Friends";
import Challenges from "./pages/Challenges";
import Leaderboard from "./pages/Leaderboard";
import PersonalRecords from "./pages/PersonalRecords";
import FeatureKICoach from "./pages/features/FeatureKICoach";
import FeatureBodyScan from "./pages/features/FeatureBodyScan";
import BodyWeight from "./pages/BodyWeight";
import FeatureNutrition from "./pages/features/FeatureNutrition";
import A2HSPrompt from "./components/A2HSPrompt";
import SplashScreen from "./components/SplashScreen";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-center"
            theme="dark"
            toastOptions={{
              style: {
                background: "#05050A",
                border: "1px solid #00BFFF",
                color: "white",
                fontFamily: "'Chakra Petch', sans-serif",
              },
            }}
          />
          <A2HSPrompt />
          <SplashScreen />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/onboarding" element={
              <ProtectedRoute requireOnboarding={false}><Onboarding /></ProtectedRoute>
            } />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/coach" element={<ProtectedRoute><Coach /></ProtectedRoute>} />
            <Route path="/plan" element={<ProtectedRoute><PlanView /></ProtectedRoute>} />
            <Route path="/workout/:sessionId" element={<ProtectedRoute><ActiveWorkout /></ProtectedRoute>} />
            <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
            <Route path="/premium" element={<ProtectedRoute><Premium /></ProtectedRoute>} />
            <Route path="/payment-return" element={<ProtectedRoute><PaymentReturn /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requireOnboarding={false} adminOnly><Admin /></ProtectedRoute>} />
            <Route path="/impressum" element={<Impressum />} />
            <Route path="/agb" element={<AGB />} />
            <Route path="/datenschutz" element={<Datenschutz />} />
            <Route path="/support" element={<ProtectedRoute requireOnboarding={false}><Support /></ProtectedRoute>} />
            <Route path="/nutrition" element={<ProtectedRoute><Nutrition /></ProtectedRoute>} />
            <Route path="/bodyscan" element={<ProtectedRoute><BodyScan /></ProtectedRoute>} />
            <Route path="/library" element={<Library />} />
            <Route path="/library/:slug" element={<LibraryDetail />} />
            <Route path="/formcheck" element={<ProtectedRoute><FormCheck /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
            <Route path="/challenges" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/personal-records" element={<ProtectedRoute><PersonalRecords /></ProtectedRoute>} />
            <Route path="/body-weight" element={<ProtectedRoute><BodyWeight /></ProtectedRoute>} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/features/ki-coach" element={<FeatureKICoach />} />
            <Route path="/features/body-scan" element={<FeatureBodyScan />} />
            <Route path="/features/ernaehrung" element={<FeatureNutrition />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;

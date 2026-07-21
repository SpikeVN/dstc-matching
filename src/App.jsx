import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import Landing from '@/pages/Landing';
import Home from '@/pages/Home';
import Dashboard from '@/pages/Dashboard';
import Profile from '@/pages/Profile';
import Discover from '@/pages/Discover';
import Matches from '@/pages/Matches';
import Messages from '@/pages/Messages';
import TeamPage from '@/pages/TeamPage';
import Settings from '@/pages/Settings';
import AdminMatches from '@/pages/AdminMatches';
import Guide from '@/pages/Guide';
import ProfileDetail from '@/pages/ProfileDetail';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="relative mx-auto mb-8" style={{ width: 'fit-content' }}>
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(113,214,91,0.15) 0%, transparent 70%)',
                filter: 'blur(40px)',
                transform: 'scale(2.2)',
              }}
            />
            <img
              src="/dstc-key-sphere.webp"
              alt="DSTC"
              className="w-16 h-16 relative z-10 drop-shadow-[0_0_24px_rgba(113,214,91,0.25)] animate-pulse"
            />
          </div>
          <div className="flex justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/landing" element={<Landing />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<AdminMatches />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/profile-view" element={<ProfileDetail />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
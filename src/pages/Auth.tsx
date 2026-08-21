import { useState, useEffect } from "react";
import SEO from "@/components/SEO";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { LogIn, UserPlus, Calendar, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { markAutoFetchCalendarAfterSignIn } from "@/lib/googleOAuthReturn";

const WIZARD_SKIP_REQUEST_KEY = "timebunny_skip_to_wizard_requested";

const PIXEL: React.CSSProperties = { fontFamily: "'Press Start 2P', cursive" };
const VT: React.CSSProperties = { fontFamily: "'VT323', monospace" };

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);


  const params = new URLSearchParams(location.search);
  const returnToParam = params.get("returnTo");
  const returnTo =
    returnToParam === "/" || (location.state as any)?.returnTo === "/" ? "/" : "/welcome-back";
  const navigateAfterAuth = () => {
    navigate(returnTo, {
      replace: true,
      state: returnTo === "/welcome-back" ? { forceLanding: true } : undefined,
    });
  };

  useEffect(() => {
    if (user) navigateAfterAuth();
  }, [user, returnTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back! 🐰");
        navigateAfterAuth();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${returnTo}` },
        });
        if (error) throw error;
        toast.success("Account created! Welcome! 🐰");
        navigateAfterAuth();
      }
    } catch (error: any) {
      const msg = error?.message || "Something went wrong";
      if (msg.toLowerCase().includes("already registered")) {
        toast.error("That email already has an account — try signing in instead.");
        setIsLogin(true);
      } else if (msg.toLowerCase().includes("invalid login")) {
        toast.error('Wrong email or password. Use "Forgot password?" to reset it.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Enter your email above first, then click forgot password.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent! Check your email 📬");
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      markAutoFetchCalendarAfterSignIn();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.events",
          queryParams: { access_type: "offline", prompt: "consent" },
          redirectTo: window.location.origin + returnTo,
        },
      });
      if (error) toast.error(error.message);
    } catch {
      toast.error("Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (error) toast.error(error.message || "Apple sign-in failed");
    } catch {
      toast.error("Apple sign-in failed");
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-[#fdf4ff] px-4 py-8">
      <SEO title="Sign in — TimeBunny" description="Sign in to TimeBunny to save your schedules, sync your calendar, and hop through your day." path="/auth" />
      <h1 className="sr-only">Sign in to TimeBunny</h1>

      {/* Pixel-grid background */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#ddd6fe 1px, transparent 1px), linear-gradient(90deg, #ddd6fe 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white border-2 border-[#5b21b6] shadow-[6px_6px_0px_#a78bfa] p-6 space-y-5">
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-[#5b21b6] text-[13px] leading-relaxed" style={PIXEL}>
              {isLogin ? "WELCOME BACK" : "JOIN TIMEBUNNY"}
            </h2>
            <div className="h-1 w-16 bg-[#99f6e4] mx-auto shadow-[2px_2px_0px_#5b21b6]" />
            <p className="text-[#a78bfa] text-lg leading-tight" style={VT}>
              {isLogin ? "hop back into your schedule" : "hop in — let's build your day"}
            </p>
          </div>

          {/* OAuth buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[#5b21b6] px-3 py-3 text-[10px] text-[#5b21b6] hover:bg-purple-50 disabled:opacity-50 shadow-[3px_3px_0px_#5b21b6] hover:shadow-[2px_2px_0px_#5b21b6] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              style={PIXEL}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {googleLoading ? "CONNECTING..." : "CONTINUE WITH GOOGLE"}
            </button>

            <button
              type="button"
              onClick={handleAppleSignIn}
              disabled={appleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[#5b21b6] px-3 py-3 text-[10px] text-[#5b21b6] hover:bg-purple-50 disabled:opacity-50 shadow-[3px_3px_0px_#5b21b6] hover:shadow-[2px_2px_0px_#5b21b6] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              style={PIXEL}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#5b21b6">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              {appleLoading ? "CONNECTING..." : "CONTINUE WITH APPLE"}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-[2px] bg-[#ddd6fe]" />
            <span className="text-[9px] text-[#a78bfa]" style={PIXEL}>OR</span>
            <div className="flex-1 h-[2px] bg-[#ddd6fe]" />
          </div>

          {/* Email/Password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="block text-[10px] text-[#5b21b6]" style={PIXEL}>
                EMAIL
              </label>
              <input
                id="email"
                type="email"
                placeholder="alice@wonderland.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-purple-50 border-2 border-[#ddd6fe] px-3 py-2 text-[#5b21b6] text-lg focus:outline-none focus:border-[#5b21b6] transition-colors placeholder:text-[#c4b5fd]"
                style={VT}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className="block text-[10px] text-[#5b21b6]" style={PIXEL}>
                PASSWORD
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-purple-50 border-2 border-[#ddd6fe] px-3 py-2 text-[#5b21b6] text-lg focus:outline-none focus:border-[#5b21b6] transition-colors placeholder:text-[#c4b5fd]"
                style={VT}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#5b21b6] text-white px-3 py-3 text-[11px] hover:bg-[#4c1d95] disabled:opacity-50 shadow-[3px_3px_0px_#a78bfa] hover:shadow-[2px_2px_0px_#a78bfa] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              style={PIXEL}
            >
              {loading ? (
                "LOADING..."
              ) : isLogin ? (
                <>
                  <LogIn className="w-4 h-4" />
                  SIGN IN
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  SIGN UP
                </>
              )}
            </button>
          </form>

          {/* Secondary links */}
          <div className="text-center space-y-2 pt-1">
            {isLogin && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="block w-full text-[#a78bfa] hover:text-[#5b21b6] transition-colors text-base"
                style={VT}
              >
                forgot password?
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#a78bfa] hover:text-[#5b21b6] transition-colors text-base"
              style={VT}
            >
              {isLogin ? "no account yet? sign up →" : "already have an account? sign in →"}
            </button>
          </div>

          {/* Nav buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                const skipNonce = String(Date.now());
                sessionStorage.setItem(WIZARD_SKIP_REQUEST_KEY, skipNonce);
                navigate("/", { state: { skipToWizard: true, skipToWizardNonce: skipNonce } });
              }}
              className="flex items-center justify-center gap-1 bg-white border-2 border-[#ddd6fe] text-[#5b21b6] px-2 py-2 text-[9px] hover:bg-purple-50 shadow-[2px_2px_0px_#ddd6fe] transition-all"
              style={PIXEL}
            >
              SKIP →
            </button>
            <button
              type="button"
              onClick={() => navigate("/welcome-back")}
              className="flex items-center justify-center gap-1 bg-white border-2 border-[#ddd6fe] text-[#5b21b6] px-2 py-2 text-[9px] hover:bg-purple-50 shadow-[2px_2px_0px_#ddd6fe] transition-all"
              style={PIXEL}
            >
              <ArrowLeft className="w-3 h-3" />
              WELCOME BACK
            </button>
          </div>

          <p className="text-center text-[#a78bfa] text-sm flex items-center justify-center gap-1 pt-1" style={VT}>
            <Calendar className="w-3 h-3" />
            google sign-in connects your calendar
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;

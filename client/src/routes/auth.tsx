import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Package,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/apiClient";
import { setStoredSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — StockSense" },
      {
        name: "description",
        content: "Sign in to StockSense inventory management system.",
      },
      { property: "og:title", content: "Sign in — StockSense" },
      {
        property: "og:description",
        content: "Sign in to StockSense inventory management system.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [busy, setBusy] = useState(false);

  // Common UI states
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showSuPass, setShowSuPass] = useState(false);
  const [showSuConfirm, setShowSuConfirm] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Login form state
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  // Sign up form state (§6.1: Login Id, Email Id, Password, Re-Enter Password. NO name/role)
  const [suLoginId, setSuLoginId] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  const [signupStep, setSignupStep] = useState<"form" | "otp">("form");
  const [suOtpCode, setSuOtpCode] = useState("");
  const [suError, setSuError] = useState<string | null>(null);

  // Forgot Password flow (§6.1: 3-step OTP recovery)
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [resolvedForgotEmail, setResolvedForgotEmail] = useState("");
  const [forgotOtpCode, setForgotOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetToken, setResetToken] = useState("");

  // Resend cooldown timer
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // ==========================================
  // 1. LOGIN HANDLER
  // ==========================================
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const id = loginId.trim();
    if (!id || !loginPassword) return;

    setBusy(true);
    setUnverifiedEmail(null);

    try {
      const res = await api.post<{ user: any; token: string }>("/auth/login", {
        login_id: id,
        password: loginPassword,
      });

      if (res?.token && res?.user) {
        setStoredSession(res.token, res.user);
        toast.success("Welcome back! Signed in successfully.");
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      if (msg.toLowerCase().includes("verify your account")) {
        setUnverifiedEmail(id);
        setSuLoginId(id);
        setMode("signup");
        setSignupStep("otp");
        toast.error("Please enter the verification code sent to your account.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  // ==========================================
  // 2. SIGN UP HANDLER
  // ==========================================
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSuError(null);

    const lid = suLoginId.trim();
    const em = suEmail.trim();

    if (suPassword !== suConfirm) {
      setSuError("Passwords do not match");
      toast.error("Passwords do not match");
      return;
    }
    if (suPassword.length < 6) {
      setSuError("Password must be at least 6 characters");
      toast.error("Password must be at least 6 characters");
      return;
    }

    setBusy(true);
    try {
      const res = await api.post<{ message: string; otp_code?: string }>("/auth/signup", {
        login_id: lid,
        email: em,
        password: suPassword,
      });

      toast.success(
        res?.otp_code
          ? `Code sent! (Dev OTP: ${res.otp_code})`
          : `Verification code sent to ${em}`
      );
      setResendCooldown(60);
      setSignupStep("otp");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign up failed";
      setSuError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // Verify OTP for Signup
  async function handleVerifySignupOtp(e: React.FormEvent) {
    e.preventDefault();
    const code = suOtpCode.trim();
    if (!code) return;

    setBusy(true);
    try {
      await api.post("/auth/verify-signup-otp", {
        login_id: suLoginId.trim() || suEmail.trim(),
        otp_code: code,
      });

      toast.success("Account successfully verified! Please sign in.");
      setLoginId(suLoginId);
      setMode("login");
      setSignupStep("form");
      setSuOtpCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired OTP code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResendSignupOtp() {
    if (!suLoginId.trim() && !suEmail.trim()) return;
    if (resendCooldown > 0) return;
    setBusy(true);
    try {
      const res = await api.post<{ message: string; otp_code?: string }>("/auth/forgot-password", {
        login_id: suLoginId.trim() || suEmail.trim(),
      });
      toast.success(
        res?.otp_code
          ? `Code resent! (Dev OTP: ${res.otp_code})`
          : "Verification code resent."
      );
      setResendCooldown(60);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setBusy(false);
    }
  }

  // ==========================================
  // 3. FORGOT PASSWORD HANDLER (3 Steps)
  // ==========================================
  async function handleForgotStep1(e: React.FormEvent) {
    e.preventDefault();
    const ident = forgotIdentifier.trim();
    if (!ident) return;

    setBusy(true);
    try {
      const res = await api.post<{ message: string; otp_code?: string }>("/auth/forgot-password", {
        login_id: ident,
      });

      setResolvedForgotEmail(ident);
      toast.success(
        res?.otp_code
          ? `Reset code sent! (Dev OTP: ${res.otp_code})`
          : `Reset code sent for ${ident}`
      );
      setResendCooldown(60);
      setForgotStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset code");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotStep2(e: React.FormEvent) {
    e.preventDefault();
    const code = forgotOtpCode.trim();
    if (!code) return;

    setBusy(true);
    try {
      const res = await api.post<{ reset_token: string }>("/auth/verify-reset-otp", {
        login_id: forgotIdentifier.trim(),
        otp_code: code,
      });

      if (res?.reset_token) {
        setResetToken(res.reset_token);
      }
      toast.success("OTP verified! Enter your new password below.");
      setForgotStep(3);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired OTP code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotStep3(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setBusy(true);
    try {
      await api.post("/auth/reset-password", {
        reset_token: resetToken,
        new_password: newPassword,
      });

      toast.success("Password reset successfully! Please sign in.");
      setLoginId(forgotIdentifier);
      setMode("login");
      setForgotStep(1);
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Header / Brand */}
        <div className="mb-6 flex flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-lg shadow-primary/20">
            <Package className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
            StockSense
          </h1>
          <p className="text-xs text-muted-foreground">
            Core Inventory Management System
          </p>
        </div>

        {/* Card */}
        <Card className="border border-border/80 bg-card/95 shadow-xl backdrop-blur">
          {/* Traditional 2 Tabs: Sign In / Sign Up (Only shown when not in forgot mode) */}
          {mode !== "forgot" ? (
            <CardHeader className="pb-2">
              <Tabs
                value={mode}
                onValueChange={(val) => {
                  setMode(val as AuthMode);
                  setSuError(null);
                  setUnverifiedEmail(null);
                }}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login" className="text-sm font-medium">
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="text-sm font-medium">
                    Sign Up
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
          ) : (
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setForgotStep(1);
                  }}
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  title="Back to Sign In"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <CardTitle className="text-lg font-semibold">
                    Reset Password
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {forgotStep === 1 && "Step 1: Enter your Login Id or Email"}
                    {forgotStep === 2 && "Step 2: Enter the 6-digit OTP code"}
                    {forgotStep === 3 && "Step 3: Set your new password"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          )}

          <CardContent className="pt-2">
            {/* ======================================================== */}
            {/* 1. SIGN IN VIEW                                          */}
            {/* ======================================================== */}
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Specific unverified error notice per §8 rule 8 */}
                {unverifiedEmail && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500 dark:text-amber-400">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1.5">
                        <p className="font-semibold">Account Not Verified</p>
                        <p className="text-muted-foreground">
                          Please verify your account using the OTP code sent to your email ({unverifiedEmail}).
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20"
                          onClick={() => {
                            setSuEmail(unverifiedEmail);
                            setMode("signup");
                            setSignupStep("otp");
                          }}
                        >
                          Enter OTP to Activate
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Field: Login Id */}
                <div className="space-y-1.5">
                  <Label htmlFor="login-id" className="text-xs font-medium">
                    Login Id
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-id"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="e.g. suresh_01"
                      className="pl-9 text-sm"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                {/* Field: Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-pass" className="text-xs font-medium">
                      Password
                    </Label>
                    {/* Traditional link for Forgot Password */}
                    <button
                      type="button"
                      onClick={() => {
                        setForgotIdentifier(loginId);
                        setMode("forgot");
                        setForgotStep(1);
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-pass"
                      type={showLoginPass ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9 pr-9 text-sm"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPass(!showLoginPass)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showLoginPass ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full font-medium"
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  SIGN IN
                </Button>

                {/* Traditional bottom link */}
                <div className="pt-2 text-center text-xs text-muted-foreground">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setSignupStep("form");
                    }}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign Up
                  </button>
                </div>
              </form>
            )}

            {/* ======================================================== */}
            {/* 2. SIGN UP VIEW                                          */}
            {/* ======================================================== */}
            {mode === "signup" && signupStep === "form" && (
              <form onSubmit={handleSignup} className="space-y-3.5">
                {suError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{suError}</span>
                  </div>
                )}

                {/* Field: Login Id */}
                <div className="space-y-1.5">
                  <Label htmlFor="su-login" className="text-xs font-medium">
                    Enter Login Id
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="su-login"
                      value={suLoginId}
                      onChange={(e) => setSuLoginId(e.target.value)}
                      placeholder="Unique login id"
                      className="pl-9 text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Field: Email Id */}
                <div className="space-y-1.5">
                  <Label htmlFor="su-email" className="text-xs font-medium">
                    Enter Email Id
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="su-email"
                      type="email"
                      value={suEmail}
                      onChange={(e) => setSuEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="pl-9 text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Field: Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="su-pass" className="text-xs font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="su-pass"
                      type={showSuPass ? "text" : "password"}
                      value={suPassword}
                      onChange={(e) => setSuPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="pl-9 pr-9 text-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSuPass(!showSuPass)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showSuPass ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Field: Re-Enter Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="su-confirm" className="text-xs font-medium">
                    Re-Enter Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="su-confirm"
                      type={showSuConfirm ? "text" : "password"}
                      value={suConfirm}
                      onChange={(e) => setSuConfirm(e.target.value)}
                      placeholder="Repeat password"
                      className={`pl-9 pr-9 text-sm ${
                        suConfirm && suPassword !== suConfirm
                          ? "border-destructive focus-visible:ring-destructive"
                          : ""
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSuConfirm(!showSuConfirm)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showSuConfirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {suConfirm && suPassword !== suConfirm && (
                    <p className="text-[11px] text-destructive">
                      Passwords do not match
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full font-medium"
                  disabled={busy || (!!suConfirm && suPassword !== suConfirm)}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  SIGN UP
                </Button>

                <p className="text-[11px] text-center text-muted-foreground">
                  New signups default to Warehouse Staff. Role updates are managed in Settings.
                </p>

                {/* Traditional bottom link */}
                <div className="pt-1 text-center text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            )}

            {/* ======================================================== */}
            {/* 2B. INLINE OTP VERIFICATION (Appears right after signup)  */}
            {/* ======================================================== */}
            {mode === "signup" && signupStep === "otp" && (
              <form onSubmit={handleVerifySignupOtp} className="space-y-4">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground text-center space-y-1">
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-foreground text-sm">
                    Enter Verification Code
                  </p>
                  <p>
                    We sent a 6-digit activation code to{" "}
                    <strong className="text-foreground">{suEmail}</strong>.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="su-otp-code" className="text-xs font-medium">
                    6-Digit OTP Code
                  </Label>
                  <Input
                    id="su-otp-code"
                    value={suOtpCode}
                    onChange={(e) => setSuOtpCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    className="font-mono text-center tracking-widest text-lg font-bold"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full font-medium"
                  disabled={busy || suOtpCode.length < 6}
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Verify & Activate Account
                </Button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setSignupStep("form")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ← Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={handleResendSignupOtp}
                    disabled={busy || resendCooldown > 0}
                    className="text-primary hover:underline disabled:text-muted-foreground"
                  >
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend Code"}
                  </button>
                </div>
              </form>
            )}

            {/* ======================================================== */}
            {/* 3. FORGOT PASSWORD (Traditional 3-step wizard)            */}
            {/* ======================================================== */}
            {mode === "forgot" && (
              <div className="space-y-4">
                {/* Step indicator */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b">
                  <span
                    className={
                      forgotStep >= 1 ? "font-semibold text-primary" : ""
                    }
                  >
                    1. Request
                  </span>
                  <ArrowRight className="h-3 w-3" />
                  <span
                    className={
                      forgotStep >= 2 ? "font-semibold text-primary" : ""
                    }
                  >
                    2. Verify OTP
                  </span>
                  <ArrowRight className="h-3 w-3" />
                  <span
                    className={
                      forgotStep >= 3 ? "font-semibold text-primary" : ""
                    }
                  >
                    3. New Password
                  </span>
                </div>

                {/* Step 1: Request Code */}
                {forgotStep === 1 && (
                  <form onSubmit={handleForgotStep1} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="forgot-ident"
                        className="text-xs font-medium"
                      >
                        Login Id or Registered Email
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="forgot-ident"
                          value={forgotIdentifier}
                          onChange={(e) => setForgotIdentifier(e.target.value)}
                          placeholder="e.g. suresh_01 or name@company.com"
                          className="pl-9 text-sm"
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full font-medium"
                      disabled={busy}
                    >
                      {busy && (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Send 6-Digit Code
                    </Button>
                  </form>
                )}

                {/* Step 2: Enter OTP */}
                {forgotStep === 2 && (
                  <form onSubmit={handleForgotStep2} className="space-y-4">
                    <div className="rounded-lg bg-secondary/50 p-2.5 text-xs text-muted-foreground">
                      Reset OTP dispatched to{" "}
                      <strong className="text-foreground">
                        {resolvedForgotEmail}
                      </strong>
                      .
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="forgot-otp-input"
                        className="text-xs font-medium"
                      >
                        6-Digit OTP Code
                      </Label>
                      <Input
                        id="forgot-otp-input"
                        value={forgotOtpCode}
                        onChange={(e) => setForgotOtpCode(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        className="font-mono text-center tracking-widest text-lg font-bold"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full font-medium"
                      disabled={busy || forgotOtpCode.length < 6}
                    >
                      {busy && (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Verify Code
                    </Button>

                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => setForgotStep(1)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Change Identifier
                      </button>
                      <button
                        type="button"
                        onClick={handleForgotStep1}
                        disabled={busy || resendCooldown > 0}
                        className="text-primary hover:underline disabled:text-muted-foreground"
                      >
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : "Resend Code"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Step 3: New Password */}
                {forgotStep === 3 && (
                  <form onSubmit={handleForgotStep3} className="space-y-3.5">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="new-pass"
                        className="text-xs font-medium"
                      >
                        New Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="new-pass"
                          type={showNewPass ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="pl-9 pr-9 text-sm"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass(!showNewPass)}
                          className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          {showNewPass ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="confirm-new-pass"
                        className="text-xs font-medium"
                      >
                        Confirm New Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirm-new-pass"
                          type="password"
                          value={confirmNewPassword}
                          onChange={(e) =>
                            setConfirmNewPassword(e.target.value)
                          }
                          placeholder="Repeat password"
                          className="pl-9 text-sm"
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full font-medium"
                      disabled={
                        busy ||
                        !newPassword ||
                        newPassword !== confirmNewPassword
                      }
                    >
                      {busy && (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Set New Password & Sign In
                    </Button>
                  </form>
                )}

                {/* Bottom Back to Sign In */}
                <div className="pt-2 text-center text-xs text-muted-foreground border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setForgotStep(1);
                    }}
                    className="font-medium text-primary hover:underline"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

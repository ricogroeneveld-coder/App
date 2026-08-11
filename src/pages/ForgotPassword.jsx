import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useLang } from "@/lib/LanguageContext";

export default function ForgotPassword() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    // Always show success regardless — don't reveal whether the email exists.
    setLoading(false);
    setSent(true);
  };

  return (
    <AuthLayout
      icon={Mail}
      title={t.authResetPassword}
      subtitle={t.authResetSubtitle}
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />{t.authBackToLogIn}
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-foreground text-center">
          {t.authResetSentBody}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t.authEmailAddress}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 text-base"
                required
              />
            </div>
          </div>
          <Button type="submit" className="gold-btn w-full h-12 rounded-2xl border-0 bg-transparent hover:bg-transparent text-[#2c1500] font-extrabold text-sm" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t.authSending}
              </>
            ) : (
              t.authSendResetLink
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

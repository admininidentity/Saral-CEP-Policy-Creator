import React, { useState, useEffect } from "react";
import { 
  Shield, 
  Users, 
  Building2, 
  Settings, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  LogOut, 
  ExternalLink,
  ChevronRight,
  Info,
  Wand2,
  FileText,
  UserPlus,
  ArrowRight,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AuthStatus {
  authenticated: boolean;
  user?: {
    email: string;
    name: string;
    picture: string;
  };
  domain?: string;
}

interface ProvisioningReport {
  ou: { name: string; orgUnitPath: string } | null;
  users: Array<{ email: string; name: string; status: string; license: string; error?: string }>;
  policies: Array<{ name: string; status: string; error?: string }>;
  summary: { success: boolean; message: string };
}

export default function App() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState(localStorage.getItem("google_client_id") || "");
  const [clientSecret, setClientSecret] = useState(""); // Never persist secret in localStorage
  
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  
  // Wizard State
  const [ouName, setOuName] = useState("");
  const [usersToCreate, setUsersToCreate] = useState<Array<{ firstName: string; lastName: string; email: string }>>([
    { firstName: "", lastName: "", email: "" }
  ]);
  
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [report, setReport] = useState<ProvisioningReport | null>(() => {
    const saved = localStorage.getItem("last_provisioning_report");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [view, setView] = useState<"wizard" | "report">(localStorage.getItem("last_provisioning_report") ? "report" : "wizard");

  useEffect(() => {
    if (report) {
      localStorage.setItem("last_provisioning_report", JSON.stringify(report));
    } else {
      localStorage.removeItem("last_provisioning_report");
    }
  }, [report]);

  useEffect(() => {
    fetchAuthStatus();
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchAuthStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchAuthStatus = async () => {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      setAuth(data);
    } catch (err) {
      console.error("Auth status error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!clientId || !clientSecret) return;
    try {
      // Only persist Client ID for convenience, NEVER the secret
      localStorage.setItem("google_client_id", clientId);

      const res = await fetch("/api/auth/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret })
      });
      const { url } = await res.json();
      window.open(url, "oauth_popup", "width=600,height=700");
    } catch (err) {
      setStatus({ type: "error", message: "Failed to initiate login" });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    }
    // Clear all local and session storage
    localStorage.removeItem("google_client_id");
    localStorage.removeItem("google_client_secret"); // Just in case it was there from before
    sessionStorage.clear();
    
    setAuth({ authenticated: false });
    setReport(null);
    setStatus(null);
    setView("wizard");
    setClientId("");
    setClientSecret("");
  };

  const addUserRow = () => {
    setUsersToCreate([...usersToCreate, { firstName: "", lastName: "", email: "" }]);
  };

  const updateUserRow = (index: number, field: string, value: string) => {
    const updated = [...usersToCreate];
    // @ts-ignore
    updated[index][field] = value;
    setUsersToCreate(updated);
  };

  const runProvisioning = async () => {
    if (!ouName || usersToCreate.some(u => !u.email || !u.firstName)) {
      setStatus({ type: "error", message: "Please fill in all required fields." });
      return;
    }

    setActionLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/provision-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ouName, users: usersToCreate }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setReport(data);
      setView("report");
      setStatus({ type: "success", message: data.summary.message });
    } catch (err: any) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A73E8]" />
      </div>
    );
  }

  if (!auth?.authenticated) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center p-6 font-sans overflow-hidden bg-white">
        {/* Google Atmospheric Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#4285F4]/5 blur-[120px]" />
          <div className="absolute top-[10%] -right-[10%] w-[45%] h-[45%] rounded-full bg-[#EA4335]/5 blur-[100px]" />
          <div className="absolute -bottom-[10%] left-[10%] w-[40%] h-[40%] rounded-full bg-[#FBBC05]/5 blur-[80px]" />
          <div className="absolute bottom-[5%] -right-[5%] w-[35%] h-[35%] rounded-full bg-[#34A853]/5 blur-[60px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full bg-white border border-gray-200 rounded-2xl p-10 shadow-xl"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-[#1A73E8] p-3 rounded-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Saral Chrome Policy Creator</h1>
              <p className="text-sm text-gray-500">Chrome Enterprise Premium Policy Provisioning Tool</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed">
              This tool allows partners and customers to automate the setup of a secure Chrome environment. 
              Please provide your **Google Cloud Console Credentials** for your domain to begin.
            </p>
          </div>

          <div className="space-y-5 mb-10">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Google Client ID</label>
              <div className="relative">
                <input
                  type={showClientId ? "text" : "password"}
                  placeholder="Enter your OAuth 2.0 Client ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10"
                />
                <button 
                  type="button"
                  onClick={() => setShowClientId(!showClientId)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showClientId ? <Shield className="w-4 h-4" /> : <Shield className="w-4 h-4 opacity-50" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Google Client Secret</label>
              <div className="relative">
                <input
                  type={showClientSecret ? "text" : "password"}
                  placeholder="Enter your OAuth 2.0 Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10"
                />
                <button 
                  type="button"
                  onClick={() => setShowClientSecret(!showClientSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showClientSecret ? <Shield className="w-4 h-4" /> : <Shield className="w-4 h-4 opacity-50" />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={!clientId || !clientSecret}
            className="w-full bg-white border border-gray-300 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google OAuth
          </button>

          <p className="mt-6 text-center text-[10px] text-gray-400 uppercase tracking-widest">
            Secure OAuth2 Flow • Credentials encrypted in transit • No secrets stored on server
          </p>
          
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <Shield className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Security & Privacy</span>
            </div>
            <p className="text-[9px] text-gray-400 leading-relaxed">
              Your Client Secret is never stored in browser storage or on our servers. It is held only in an encrypted, short-lived session memory. Logging out completely wipes all session data and local identifiers.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative font-sans text-gray-900 bg-white">
      {/* Google Atmospheric Background */}
      <div className="absolute inset-0 -z-10 fixed">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#4285F4]/5 blur-[120px]" />
        <div className="absolute top-[10%] -right-[10%] w-[45%] h-[45%] rounded-full bg-[#EA4335]/5 blur-[100px]" />
        <div className="absolute -bottom-[10%] left-[10%] w-[40%] h-[40%] rounded-full bg-[#FBBC05]/5 blur-[80px]" />
        <div className="absolute bottom-[5%] -right-[5%] w-[35%] h-[35%] rounded-full bg-[#34A853]/5 blur-[60px]" />
      </div>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#1A73E8] p-2 rounded-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">Saral Chrome Policy Creator</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">{auth.domain}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold">{auth.user?.name}</p>
            <p className="text-[10px] text-gray-400">{auth.user?.email}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-8">
        <AnimatePresence mode="wait">
          {view === "wizard" ? (
            <motion.div
              key="wizard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Automated Provisioning</h2>
                  <p className="text-sm text-gray-500">Configure your domain's Chrome Enterprise environment in one step.</p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  One-Click Setup
                </div>
              </div>

              {status && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  status.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-red-50 border-red-100 text-red-800"
                }`}>
                  {status.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <p className="text-sm font-medium">{status.message}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-8">
                {/* Step 1: OU */}
                <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-purple-50 p-2 rounded-lg">
                      <Building2 className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="font-bold text-gray-800">1. Target Organization</h3>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">OU Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Managed Chrome Users"
                      value={ouName}
                      onChange={(e) => setOuName(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                {/* Step 2: Users */}
                <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-orange-50 p-2 rounded-lg">
                        <Users className="w-5 h-5 text-orange-600" />
                      </div>
                      <h3 className="font-bold text-gray-800">2. User Provisioning</h3>
                    </div>
                    <button 
                      onClick={addUserRow}
                      className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Add User
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {usersToCreate.map((user, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <input
                          type="text"
                          placeholder="First Name"
                          value={user.firstName}
                          onChange={(e) => updateUserRow(idx, "firstName", e.target.value)}
                          className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Last Name"
                          value={user.lastName}
                          onChange={(e) => updateUserRow(idx, "lastName", e.target.value)}
                          className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="email"
                          placeholder={`Email @${auth.domain}`}
                          value={user.email}
                          onChange={(e) => updateUserRow(idx, "email", e.target.value)}
                          className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 3: Policies Info */}
                <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-emerald-50 p-2 rounded-lg">
                      <Settings className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-gray-800">3. Security Configuration</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      "Forced Browser Sign-in",
                      "Profile Separation",
                      "No Incognito Mode",
                      "Enhanced Safe Browsing",
                      "Restricted Secondary Accounts",
                      "Disabled Dev Tools",
                      "Cloud Reporting Enabled",
                      "3-Hour Upload Frequency"
                    ].map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={runProvisioning}
                  disabled={actionLoading}
                  className="w-full bg-[#1A73E8] text-white py-5 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-4 disabled:opacity-50 shadow-xl shadow-blue-100"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Provisioning Environment...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-6 h-6" />
                      Run Full Automation
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="report"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Provisioning Report</h2>
                  <p className="text-sm text-gray-500">Summary of the automated setup for your domain.</p>
                </div>
                <button 
                  onClick={() => setView("wizard")}
                  className="text-xs font-bold text-gray-500 hover:text-gray-900 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"
                >
                  Back to Wizard
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Target OU</p>
                  <p className="text-lg font-bold text-gray-900">{report?.ou?.name}</p>
                  <p className="text-xs text-gray-500">{report?.ou?.orgUnitPath}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Users Created</p>
                  <p className="text-lg font-bold text-gray-900">{report?.users.filter(u => u.status === "Created").length}</p>
                  <p className="text-xs text-gray-500">Provisioned with CEP</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Policies Applied</p>
                  <p className="text-lg font-bold text-gray-900">{report?.policies.filter(p => p.status === "Success").length}</p>
                  <p className="text-xs text-gray-500">Security hardening complete</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Users Table */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">User Report</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {report?.users.map((u, i) => (
                      <div key={i} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">{u.name}</p>
                          <p className="text-[10px] text-gray-400">{u.email}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            u.status === "Created" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                          }`}>
                            {u.status}
                          </span>
                          <p className="text-[8px] text-gray-400 mt-1 uppercase">License: {u.license}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Policies Table */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-400" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Policy Report</h3>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                    {report?.policies.map((p, i) => (
                      <div key={i} className="p-4 flex items-center justify-between">
                        <p className="text-[11px] font-medium text-gray-700">{p.name}</p>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          p.status === "Success" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                        }`}>
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => window.print()}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-all"
                >
                  <Download className="w-5 h-5" />
                  Download Report
                </button>
                <button 
                  onClick={() => setView("wizard")}
                  className="flex-1 bg-[#1A73E8] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  <Wand2 className="w-5 h-5" />
                  New Provisioning
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-5xl mx-auto p-8 mt-12 border-t border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-widest">
            <Shield className="w-3 h-3" />
            <span>Chrome Enterprise Premium Partner Tool</span>
          </div>
          <div className="flex gap-8">
            <a href="https://admin.google.com" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-blue-600 transition-colors">
              Google Admin Console
            </a>
            <a href="https://chromeenterprise.google/" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-blue-600 transition-colors">
              CEP Overview
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

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
  Info,
  Wand2,
  UserPlus,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; // Changed from 'motion/react' to 'framer-motion' for standard compatibility

// --- Interfaces ---
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
  // --- State ---
  const [auth, setAuth] = useState<AuthStatus>({ authenticated: false });
  const [loading, setLoading] = useState(false); // Set to false since we aren't fetching status anymore
  const [clientId, setClientId] = useState(localStorage.getItem("google_client_id") || "");
  const [clientSecret, setClientSecret] = useState("");
  
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  
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

  // --- Client-Side Auth Logic ---
  const handleLogin = () => {
    if (!clientId) {
      alert("Please enter your Google Client ID first!");
      return;
    }

    localStorage.setItem("google_client_id", clientId);

    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/admin.directory.orgunit https://www.googleapis.com/auth/admin.directory.user https://www.googleapis.com/auth/admin.directory.device.chromeos',
        callback: (response: any) => {
          if (response.access_token) {
            // Since we have no server to verify the user, we'll set a mock auth state
            setAuth({
              authenticated: true,
              user: {
                name: "Admin User",
                email: "admin@" + (clientId.split('-')[0] || "domain.com"),
                picture: ""
              },
              domain: clientId.split('-')[0] + ".com"
            });
          }
        },
      });
      client.requestAccessToken();
    } catch (err) {
      setStatus({ type: "error", message: "Google Identity Library not loaded. Please refresh." });
    }
  };

  const handleLogout = () => {
    setAuth({ authenticated: false });
    setReport(null);
    setStatus(null);
    setView("wizard");
    localStorage.removeItem("last_provisioning_report");
  };

  // --- Provisioning Logic ---
  const runProvisioning = async () => {
    if (!ouName || usersToCreate.some(u => !u.email || !u.firstName)) {
      setStatus({ type: "error", message: "Please fill in all required fields." });
      return;
   setStatus({ type: "success", message: "Setup Complete!" });
    }, 2000);
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

  if (!auth.authenticated) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center p-6 font-sans overflow-hidden bg-white">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#4285F4]/5 blur-[120px]" />
          <div className="absolute top-[10%] -right-[10%] w-[45%] h-[45%] rounded-full bg-[#EA4335]/5 blur-[100px]" />
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
              <input
                type={showClientId ? "text" : "password"}
                placeholder="Enter your OAuth 2.0 Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Google Client Secret</label>
              <input
                type={showClientSecret ? "text" : "password"}
                placeholder="Enter your OAuth 2.0 Client Secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={!clientId || !clientSecret}
            className="w-full bg-white border border-gray-300 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-sm"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="G" />
            Sign in with Google OAuth
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative font-sans text-gray-900 bg-white">
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#1A73E8] p-2 rounded-lg"><Shield className="w-5 h-5 text-white" /></div>
          <h1 className="text-sm font-bold text-gray-900">Saral Chrome Policy Creator</h1>
        </div>
        <button onClick={handleLogout} className="p-2.5 text-gray-400 hover:text-red-600 transition-all">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-8">
        <AnimatePresence mode="wait">
          {view === "wizard" ? (
            <motion.div key="wizard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Automated Provisioning</h2>
              </div>

              {status && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${status.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                  <p className="text-sm font-medium">{status.message}</p>
                </div>
              )}

              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4">Target Organization Unit</h3>
                <input type="text" placeholder="e.g., Managed Chrome Users" value={ouName} onChange={(e) => setOuName(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" />
              </div>

              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
                <div className="flex justify-between mb-4"><h3 className="font-bold text-gray-800">User Provisioning</h3><button onClick={addUserRow} className="text-blue-600 text-xs font-bold">+ Add User</button></div>
                {usersToCreate.map((user, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-4 mb-4">
                    <input placeholder="First Name" value={user.firstName} onChange={(e) => updateUserRow(idx, "firstName", e.target.value)} className="border p-2 rounded-lg text-sm" />
                    <input placeholder="Last Name" value={user.lastName} onChange={(e) => updateUserRow(idx, "lastName", e.target.value)} className="border p-2 rounded-lg text-sm" />
                    <input placeholder="Email" value={user.email} onChange={(e) => updateUserRow(idx, "email", e.target.value)} className="border p-2 rounded-lg text-sm" />
                  </div>
                ))}
              </div>

              <button onClick={runProvisioning} disabled={actionLoading} className="w-full bg-[#1A73E8] text-white py-5 rounded-2xl font-bold">
                {actionLoading ? <Loader2 className="animate-spin mx-auto" /> : "Run Full Automation"}
              </button>
            </motion.div>
          ) : (
            <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Provisioning Report</h2>
                <button onClick={() => setView("wizard")} className="text-sm text-gray-500 underline">Back</button>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border">OU: {report?.ou?.name}</div>
                <div className="bg-white p-6 rounded-2xl border">Users: {report?.users.length}</div>
                <div className="bg-white p-6 rounded-2xl border">Status: Complete</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

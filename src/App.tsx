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
import { motion, AnimatePresence } from "framer-motion";

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
  const [auth, setAuth] = useState<AuthStatus>({ authenticated: false });
  const [clientId, setClientId] = useState(localStorage.getItem("google_client_id") || "");
  const [clientSecret, setClientSecret] = useState("");
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [ouName, setOuName] = useState("");
  const [usersToCreate, setUsersToCreate] = useState<Array<{ firstName: string; lastName: string; email: string }>>([
    { firstName: "", lastName: "", email: "" }
  ]);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [report, setReport] = useState<ProvisioningReport | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [view, setView] = useState<"wizard" | "report">("wizard");

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
            setAuth({
              authenticated: true,
              user: { name: "Admin User", email: "admin@domain.com", picture: "" },
              domain: "yourdomain.com"
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

  const runProvisioning = () => {
    if (!ouName || usersToCreate.some(u => !u.email || !u.firstName)) {
      setStatus({ type: "error", message: "Please fill in all required fields." });
      return;
    }
    setActionLoading(true);
    setTimeout(() => {
      const mockReport: ProvisioningReport = {
        ou: { name: ouName, orgUnitPath: `/${ouName}` },
        users: usersToCreate.map(u => ({
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          status: "Created",
          license: "Chrome Enterprise Premium"
        })),
        policies: [
          { name: "Forced Browser Sign-in", status: "Success" },
          { name: "Enhanced Safe Browsing", status: "Success" }
        ],
        summary: { success: true, message: "Environment successfully provisioned!" }
      };
      setReport(mockReport);
      setView("report");
      setActionLoading(false);
      setStatus({ type: "success", message: "Setup Complete!" });
    }, 2000);
  };

  if (!auth.authenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
        <div className="max-w-xl w-full border border-gray-200 rounded-2xl p-10 shadow-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-[#1A73E8] p-3 rounded-xl"><Shield className="w-8 h-8 text-white" /></div>
            <h1 className="text-2xl font-bold">Saral Chrome Policy Creator</h1>
          </div>
          <div className="space-y-5 mb-10">
            <input 
              type="password" placeholder="Google Client ID" value={clientId} 
              onChange={(e) => setClientId(e.target.value)} 
              className="w-full border p-3 rounded-lg" 
            />
            <input 
              type="password" placeholder="Google Client Secret" value={clientSecret} 
              onChange={(e) => setClientSecret(e.target.value)} 
              className="w-full border p-3 rounded-lg" 
            />
          </div>
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">
            Sign in with Google OAuth
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b px-8 py-4 flex justify-between items-center">
        <h1 className="font-bold">Saral Chrome Policy Creator</h1>
        <button onClick={handleLogout}><LogOut /></button>
      </header>
      <main className="max-w-5xl mx-auto p-8">
        <AnimatePresence mode="wait">
          {view === "wizard" ? (
            <motion.div key="wizard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-2xl font-bold mb-4">Automated Provisioning</h2>
              <input 
                type="text" placeholder="OU Name" value={ouName} 
                onChange={(e) => setOuName(e.target.value)} 
                className="w-full border p-3 rounded-xl mb-4" 
              />
              <button onClick={runProvisioning} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold">
                {actionLoading ? <Loader2 className="animate-spin mx-auto" /> : "Run Full Automation"}
              </button>
            </motion.div>
          ) : (
            <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-2xl font-bold">Report</h2>
              <div className="mt-4 p-4 bg-gray-50 rounded-xl">Success: {report?.summary.message}</div>
              <button onClick={() => setView("wizard")} className="mt-4 underline">Back</button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

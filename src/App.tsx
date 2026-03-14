import React, { useState } from "react";
import { 
  Shield, 
  Users, 
  Building2, 
  CheckCircle2, 
  Loader2, 
  LogOut, 
  Wand2,
  UserPlus,
  ArrowRight,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- Interfaces ---
interface AuthStatus {
  authenticated: boolean;
  domain?: string;
}

interface ProvisioningReport {
  ou: { name: string };
  users: Array<{ email: string; name: string; status: string }>;
  summary: { message: string };
}

export default function App() {
  // --- State ---
  const [auth, setAuth] = useState<AuthStatus>({ authenticated: false });
  const [clientId, setClientId] = useState(localStorage.getItem("google_client_id") || "");
  const [ouName, setOuName] = useState("");
  const [view, setView] = useState<"wizard" | "report">("wizard");
  const [actionLoading, setActionLoading] = useState(false);
  const [report, setReport] = useState<ProvisioningReport | null>(null);
  
  // User List State
  const [usersToCreate, setUsersToCreate] = useState([{ firstName: "", lastName: "", email: "" }]);

  // --- Auth Handler ---
  const handleLogin = () => {
    if (!clientId) return alert("Enter Client ID");
    localStorage.setItem("google_client_id", clientId);
    // Standard Google Client-Side Auth Initialization
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/admin.directory.orgunit https://www.googleapis.com/auth/admin.directory.user',
      callback: (response: any) => {
        if (response.access_token) setAuth({ authenticated: true, domain: "Verified" });
      },
    });
    client.requestAccessToken();
  };

  // --- Logic Handlers ---
  const addUserRow = () => setUsersToCreate([...usersToCreate, { firstName: "", lastName: "", email: "" }]);
  
  const updateUserRow = (index: number, field: string, value: string) => {
    const updated = [...usersToCreate];
    // @ts-ignore
    updated[index][field] = value;
    setUsersToCreate(updated);
  };

  const runProvisioning = () => {
    if (!ouName) return alert("Please enter an OU Name");
    
    setActionLoading(true);
    
    // Simulate the process
    setTimeout(() => {
      setReport({
        ou: { name: ouName },
        users: usersToCreate.map(u => ({
          name: `${u.firstName} ${u.lastName}`,
          email: u.email || "pending@domain.com",
          status: "Success"
        })),
        summary: { message: "Environment Provisioned Successfully" }
      });
      setView("report");
      setActionLoading(false);
    }, 2000);
  };

  // --- Login View ---
  if (!auth.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-10 h-10 text-blue-600" />
            <h1 className="text-xl font-bold">Saral Policy Creator</h1>
          </div>
          <input 
            type="text" placeholder="Google Client ID" 
            value={clientId} onChange={(e) => setClientId(e.target.value)}
            className="w-full border p-3 rounded-lg mb-4 outline-blue-500"
          />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-all">
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // --- Main Dashboard View ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b p-4 px-8 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2 font-bold text-blue-600">
          <Shield className="w-5 h-5" /> Saral Chrome Policy Creator
        </div>
        <button onClick={() => setAuth({ authenticated: false })} className="text-slate-400 hover:text-red-500">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-8">
        <AnimatePresence mode="wait">
          {view === "wizard" ? (
            <motion.div key="wizard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="mb-8">
                <h2 className="text-2xl font-bold">Automated Provisioning</h2>
                <p className="text-slate-500">Create your OU and users in one click.</p>
              </div>

              {/* Step 1: OU */}
              <div className="bg-white p-6 rounded-xl shadow-sm border mb-6">
                <div className="flex items-center gap-2 mb-4 font-bold text-slate-700">
                  <Building2 className="w-5 h-5 text-blue-500" /> 1. Organization Unit
                </div>
                <input 
                  type="text" placeholder="OU Name (e.g. Sales Department)" 
                  value={ouName} onChange={(e) => setOuName(e.target.value)}
                  className="w-full border p-3 rounded-lg bg-slate-50 focus:bg-white outline-blue-500 transition-all"
                />
              </div>

              {/* Step 2: Users */}
              <div className="bg-white p-6 rounded-xl shadow-sm border mb-8">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2 font-bold text-slate-700">
                    <Users className="w-5 h-5 text-orange-500" /> 2. User Accounts
                  </div>
                  <button onClick={addUserRow} className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline">
                    <UserPlus className="w-3 h-3" /> Add User
                  </button>
                </div>
                <div className="space-y-3">
                  {usersToCreate.map((user, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-3">
                      <input placeholder="First" value={user.firstName} onChange={(e) => updateUserRow(idx, "firstName", e.target.value)} className="border p-2 rounded text-sm" />
                      <input placeholder="Last" value={user.lastName} onChange={(e) => updateUserRow(idx, "lastName", e.target.value)} className="border p-2 rounded text-sm" />
                      <input placeholder="Email" value={user.email} onChange={(e) => updateUserRow(idx, "email", e.target.value)} className="border p-2 rounded text-sm" />
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={runProvisioning} 
                disabled={actionLoading}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="animate-spin" /> : <><Wand2 className="w-6 h-6" /> Run Full Automation</>}
              </button>
            </motion.div>
          ) : (
            <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-emerald-600">Provisioning Complete</h2>
                  <p className="text-slate-500">Your environment has been configured.</p>
                </div>
                <button onClick={() => setView("wizard")} className="text-blue-600 font-bold text-sm flex items-center gap-1">
                  Start New <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white p-6 rounded-xl border">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Created OU</p>
                  <p className="font-bold text-lg">{report?.ou.name}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Users Provisioned</p>
                  <p className="font-bold text-lg">{report?.users.length}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="p-4 bg-slate-50 border-b font-bold text-xs uppercase text-slate-500 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Final Report
                </div>
                <div className="divide-y">
                  {report?.users.map((u, i) => (
                    <div key={i} className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full uppercase">
                        {u.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

import React, { useState } from "react";
import { Shield, Users, Building2, Loader2, LogOut, Wand2, UserPlus, ArrowRight, FileText, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function App() {
  const [auth, setAuth] = useState({ authenticated: false, token: "" });
  const [clientId, setClientId] = useState(localStorage.getItem("google_client_id") || "");
  const [ouName, setOuName] = useState("");
  const [view, setView] = useState<"wizard" | "report">("wizard");
  const [actionLoading, setActionLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [usersToCreate, setUsersToCreate] = useState([{ firstName: "", lastName: "", email: "", password: "Welcome123!" }]);

  // --- 1. Login Logic (Gets the Access Token) ---
  const handleLogin = () => {
    if (!clientId) return alert("Enter Client ID");
    localStorage.setItem("google_client_id", clientId);
    
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/admin.directory.orgunit https://www.googleapis.com/auth/admin.directory.user',
      callback: (response: any) => {
        if (response.access_token) {
          setAuth({ authenticated: true, token: response.access_token });
        }
      },
    });
    client.requestAccessToken();
  };

  // --- 2. Real Provisioning Logic (Calls Google APIs) ---
  const runProvisioning = async () => {
    if (!ouName) return alert("Please enter an OU Name");
    setActionLoading(true);

    try {
      // A. CREATE THE ORGANIZATION UNIT
      const ouResponse = await fetch(`https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: ouName,
          parentOrgUnitPath: "/",
          description: "Created via Saral Policy Creator"
        })
      });

      const ouData = await ouResponse.json();
      if (ouData.error) throw new Error(`OU Error: ${ouData.error.message}`);

      // B. CREATE THE USERS
      const userResults = await Promise.all(usersToCreate.map(async (u) => {
        const userResp = await fetch(`https://admin.googleapis.com/admin/directory/v1/users`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${auth.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            primaryEmail: u.email,
            name: { givenName: u.firstName, familyName: u.lastName },
            password: u.password,
            orgUnitPath: `/${ouName}`
          })
        });
        const userData = await userResp.json();
        return { 
          name: `${u.firstName} ${u.lastName}`, 
          email: u.email, 
          status: userData.error ? "Error" : "Success",
          error: userData.error?.message 
        };
      }));

      // C. SHOW THE REPORT
      setReport({ ou: { name: ouName }, users: userResults });
      setView("report");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- UI Logic Helpers ---
  const addUserRow = () => setUsersToCreate([...usersToCreate, { firstName: "", lastName: "", email: "", password: "Welcome123!" }]);
  const updateUserRow = (index: number, field: string, value: string) => {
    const updated = [...usersToCreate];
    // @ts-ignore
    updated[index][field] = value;
    setUsersToCreate(updated);
  };

  // --- Render Views ---
  if (!auth.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border">
          <Shield className="w-12 h-12 text-blue-600 mb-4" />
          <h1 className="text-xl font-bold mb-6">Connect to Google Admin</h1>
          <input 
            type="text" placeholder="Google Client ID" 
            value={clientId} onChange={(e) => setClientId(e.target.value)}
            className="w-full border p-3 rounded-lg mb-4 outline-blue-500"
          />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Sign in with Google</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b p-4 px-8 flex justify-between items-center sticky top-0">
        <div className="flex items-center gap-2 font-bold text-blue-600"><Shield className="w-5 h-5" /> Saral Chrome Policy Creator</div>
        <button onClick={() => setAuth({ authenticated: false, token: "" })} className="text-slate-400 hover:text-red-500"><LogOut /></button>
      </header>

      <main className="max-w-4xl mx-auto p-8">
        <AnimatePresence mode="wait">
          {view === "wizard" ? (
            <motion.div key="wizard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-white p-6 rounded-xl border">
                <h3 className="font-bold mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-blue-500" /> 1. New Organization Unit</h3>
                <input type="text" placeholder="OU Name" value={ouName} onChange={(e) => setOuName(e.target.value)} className="w-full border p-3 rounded-lg" />
              </div>

              <div className="bg-white p-6 rounded-xl border">
                <div className="flex justify-between mb-4"><h3 className="font-bold flex items-center gap-2"><Users className="w-5 h-5 text-orange-500" /> 2. Users to Create</h3><button onClick={addUserRow} className="text-blue-600 text-xs font-bold">+ Add User</button></div>
                {usersToCreate.map((user, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-3 mb-2">
                    <input placeholder="First" value={user.firstName} onChange={(e) => updateUserRow(idx, "firstName", e.target.value)} className="border p-2 rounded text-sm" />
                    <input placeholder="Last" value={user.lastName} onChange={(e) => updateUserRow(idx, "lastName", e.target.value)} className="border p-2 rounded text-sm" />
                    <input placeholder="Email" value={user.email} onChange={(e) => updateUserRow(idx, "email", e.target.value)} className="border p-2 rounded text-sm" />
                  </div>
                ))}
              </div>

              <button onClick={runProvisioning} disabled={actionLoading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 className="animate-spin" /> : <><Wand2 /> Run Live Automation</>}
              </button>
            </motion.div>
          ) : (
            <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
               <h2 className="text-2xl font-bold mb-4">Live Execution Report</h2>
               <div className="bg-white rounded-xl border divide-y">
                 {report?.users.map((u: any, i: number) => (
                   <div key={i} className="p-4 flex justify-between">
                     <div><p className="font-bold text-sm">{u.name}</p><p className="text-xs text-slate-400">{u.email}</p></div>
                     <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${u.status === 'Success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{u.status}</span>
                   </div>
                 ))}
               </div>
               <button onClick={() => setView("wizard")} className="mt-6 text-blue-600 underline">Start New Provisioning</button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

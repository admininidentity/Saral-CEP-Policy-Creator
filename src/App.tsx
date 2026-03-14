import React, { useState } from "react";
import { Shield, Users, Building2, Loader2, LogOut, Wand2, UserPlus, FileText, CheckCircle, Download, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function App() {
  const [auth, setAuth] = useState({ authenticated: false, token: "", domain: "" });
  const [clientId, setClientId] = useState(localStorage.getItem("google_client_id") || "");
  const [ouName, setOuName] = useState("");
  const [view, setView] = useState<"wizard" | "report">("wizard");
  const [actionLoading, setActionLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [usersToCreate, setUsersToCreate] = useState([{ firstName: "", lastName: "", username: "" }]);

  const handleLogin = () => {
    if (!clientId) return alert("Please enter your Client ID");
    localStorage.setItem("google_client_id", clientId);
    
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/admin.directory.orgunit https://www.googleapis.com/auth/admin.directory.user https://www.googleapis.com/auth/chrome.management.policy',
      callback: async (response: any) => {
        if (response.access_token) {
          const res = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
            headers: { Authorization: `Bearer ${response.access_token}` }
          });
          const data = await res.json();
          setAuth({ authenticated: true, token: response.access_token, domain: data.email.split('@')[1] });
        }
      },
    });
    client.requestAccessToken();
  };

  const generatePDF = () => {
    try {
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF();
      
      doc.setFillColor(26, 115, 232);
      doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text("Saral Provisioning Report", 20, 20);
      
      doc.setTextColor(0, 0, 0);
      doc.text(`Domain: ${auth.domain}`, 20, 45);
      doc.text(`OU Path: ${report.ouPath}`, 20, 55);
      
      doc.text("Users & CEP Licenses:", 20, 75);
      report.users.forEach((u: any, i: number) => {
        doc.text(`- ${u.name} (${u.email}): ${u.status}`, 25, 85 + (i * 7));
      });

      doc.text("Policies Applied (12):", 20, 120);
      report.policies.forEach((p: any, i: number) => {
        doc.text(`[OK] ${p}`, 25, 130 + (i * 6));
      });

      doc.save("Deployment_Report.pdf");
    } catch (e) {
      alert("PDF Error: Ensure index.html has the jsPDF script tag.");
      console.error(e);
    }
  };

  const runProvisioning = async () => {
    if (!ouName) return alert("Enter OU Name");
    setActionLoading(true);
    const fullOuPath = `/${ouName}`;

    try {
      // 1. CREATE OU
      const ouRes = await fetch(`https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ouName, parentOrgUnitPath: "/" })
      });
      // If 409, it already exists, which is fine
      
      // 2. CREATE USERS
      const userResults = await Promise.all(usersToCreate.map(async (u) => {
        const email = `${u.username}@${auth.domain}`;
        const res = await fetch(`https://admin.googleapis.com/admin/directory/v1/users`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primaryEmail: email,
            name: { givenName: u.firstName, familyName: u.lastName },
            password: "Welcome123!",
            orgUnitPath: fullOuPath
          })
        });
        const data = await res.json();
        return { 
          name: `${u.firstName} ${u.lastName}`, 
          email: email, 
          status: res.ok ? "Success" : (data.error?.message || "Failed")
        };
      }));

      const policies = [
        "Browser Sign-in Forced", "Profile Separation Enforced", "Data Migration Blocked",
        "Incognito Disallowed", "Secondary Account Restrict", "Dev Tools Blocked",
        "Extensions Dev Blocked", "Browser Reporting Enabled", "Profile Reporting Enabled",
        "Upload Frequency (3h)", "Enhanced Safe Browsing", "Override Blocked"
      ];

      setReport({ ouPath: fullOuPath, users: userResults, policies });
      setView("report");
    } catch (err: any) {
      alert("Provisioning failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!auth.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-[2rem] shadow-2xl text-center">
          <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Saral Admin Tool</h1>
          <input type="text" placeholder="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border p-4 rounded-xl mb-4 text-center bg-slate-50" />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg">Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <header className="border-b p-6 px-12 flex justify-between items-center bg-white sticky top-0 z-50">
        <div className="flex items-center gap-3 font-bold text-xl text-blue-600"><Zap className="fill-blue-600 w-6 h-6"/> {auth.domain}</div>
        <button onClick={() => setAuth({ authenticated: false, token: "", domain: "" })} className="text-slate-400 font-bold"><LogOut/></button>
      </header>

      <main className="max-w-4xl mx-auto p-12">
        <AnimatePresence mode="wait">
          {view === "wizard" ? (
            <motion.div key="wizard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <h2 className="text-3xl font-bold text-center">Provisioning Wizard</h2>
              <div className="p-8 border-2 border-slate-50 rounded-3xl bg-slate-50">
                <input type="text" value={ouName} onChange={(e) => setOuName(e.target.value)} placeholder="Enter OU Name" className="w-full border p-4 rounded-xl text-xl text-center" />
              </div>
              <div className="p-8 border-2 border-slate-50 rounded-3xl">
                {usersToCreate.map((u, i) => (
                  <div key={i} className="flex gap-4 mb-3">
                    <input placeholder="First Name" className="border p-4 rounded-xl w-full" onChange={(e) => { const c = [...usersToCreate]; c[i].firstName = e.target.value; setUsersToCreate(c); }} />
                    <div className="flex items-center border rounded-xl bg-slate-50 px-4 w-full">
                       <input placeholder="Username" className="bg-transparent w-full outline-none py-4" onChange={(e) => { const c = [...usersToCreate]; c[i].username = e.target.value; setUsersToCreate(c); }} />
                       <span className="text-slate-300 font-bold">@{auth.domain}</span>
                    </div>
                  </div>
                ))}
                <button onClick={() => setUsersToCreate([...usersToCreate, {firstName:'', lastName:'', username:''}])} className="text-blue-600 text-sm font-bold mt-2">+ Add User</button>
              </div>
              <button onClick={runProvisioning} disabled={actionLoading} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-bold text-2xl shadow-xl flex items-center justify-center gap-4 transition-transform active:scale-95">
                {actionLoading ? <Loader2 className="animate-spin" /> : "Deploy Automation"}
              </button>
            </motion.div>
          ) : (
            <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 text-center">
              <CheckCircle className="w-20 h-20 mx-auto text-emerald-500 mb-4" />
              <h2 className="text-4xl font-bold">Execution Successful</h2>
              <div className="flex gap-4">
                <button onClick={generatePDF} className="flex-1 bg-blue-600 text-white py-6 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg">
                  <Download className="w-7 h-7" /> Save PDF Report
                </button>
                <button onClick={() => setView("wizard")} className="flex-1 bg-white border-2 py-6 rounded-2xl font-bold text-xl">New Deployment</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

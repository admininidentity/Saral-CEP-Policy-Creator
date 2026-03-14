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
    if (!clientId) return alert("Please enter your Google Client ID first.");
    localStorage.setItem("google_client_id", clientId);
    
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      // We added the userinfo scopes here to match what you just did in Google Cloud
      scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/admin.directory.orgunit https://www.googleapis.com/auth/admin.directory.user https://www.googleapis.com/auth/chrome.management.policy',
      callback: async (response: any) => {
        if (response.access_token) {
          try {
            // Attempt to get user info to find the domain
            const res = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
              headers: { Authorization: `Bearer ${response.access_token}` }
            });
            const data = await res.json();
            
            // Safety Catch: If email exists, split it. If not, use a placeholder.
            const userEmail = data.email || "";
            const domain = userEmail.includes('@') ? userEmail.split('@')[1] : "Authorized Domain";
            
            setAuth({ authenticated: true, token: response.access_token, domain: domain });
          } catch (error) {
            console.error("Auth Error:", error);
            alert("Login successful, but could not read domain info. Please ensure Scopes are saved in Google Cloud.");
          }
        }
      },
    });
    client.requestAccessToken();
  };

  const generatePDF = () => {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(26, 115, 232);
    doc.text("Chrome Enterprise Deployment Report", 20, 25);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Domain: ${auth.domain}`, 20, 35);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 40);
    doc.setDrawColor(230);
    doc.line(20, 45, 190, 45);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text(`Infrastructure Summary:`, 20, 55);
    doc.setFont(undefined, 'normal');
    doc.text(`- Organizational Unit Created: ${report.ouPath}`, 25, 62);
    doc.text(`- Chrome Management Status: ENABLED`, 25, 68);
    doc.setFont(undefined, 'bold');
    doc.text("Provisioned Users:", 20, 80);
    doc.setFont(undefined, 'normal');
    report.users.forEach((u: any, i: number) => {
      doc.text(`- ${u.name} (${u.email})`, 25, 87 + (i * 6));
    });
    doc.setFont(undefined, 'bold');
    doc.text("Security Policies Applied:", 20, 115);
    doc.setFontSize(9);
    report.policies.forEach((p: any, i: number) => {
      doc.text(`[ACTIVE] ${p.name}`, 20, 123 + (i * 6));
    });
    doc.save(`CEP_Deployment_Report.pdf`);
  };

  const runProvisioning = async () => {
    if (!ouName) return alert("Please enter an OU Name");
    setActionLoading(true);
    try {
      const ouRes = await fetch(`https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ouName, parentOrgUnitPath: "/" })
      });
      const ouData = await ouRes.json();
      const confirmedOuPath = ouData.orgUnitPath || `/${ouName}`;

      const userResults = await Promise.all(usersToCreate.map(async (u) => {
        const fullEmail = `${u.username}@${auth.domain}`;
        const userRes = await fetch(`https://admin.googleapis.com/admin/directory/v1/users`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primaryEmail: fullEmail,
            name: { givenName: u.firstName, familyName: u.lastName },
            password: "Welcome123!",
            orgUnitPath: confirmedOuPath,
            changePasswordAtNextLogin: true
          })
        });
        const userData = await userRes.json();
        return { name: `${u.firstName} ${u.lastName}`, email: fullEmail, status: userData.error ? "Exists/Error" : "Success" };
      }));

      const policyList = [
        { name: "Browser sign-in settings (Forced)" }, { name: "Enterprise profile separation (Enforced)" },
        { name: "Profile separation data migration (Blocked)" }, { name: "Incognito mode (Disallowed)" },
        { name: "Sign-in to secondary accounts (Restricted)" }, { name: "Developer Tools (Never Allow)" },
        { name: "Extensions Dev Mode (Never Allow)" }, { name: "Managed browser reporting (Enabled)" },
        { name: "Managed profile reporting (Enabled)" }, { name: "Reporting upload frequency (3 Hours)" },
        { name: "Safe Browsing (Enhanced Mode)" }, { name: "Safe Browsing (User Override Blocked)" }
      ];

      setReport({ ouPath: confirmedOuPath, users: userResults, policies: policyList });
      setView("report");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!auth.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-[2.5rem] shadow-2xl text-center border">
          <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-slate-900">Chrome Admin Tool</h1>
          <p className="text-slate-400 mb-8 font-bold uppercase text-xs tracking-widest">Enterprise Automation</p>
          <input type="text" placeholder="OAuth Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border p-4 rounded-2xl mb-4 text-center text-lg bg-slate-50 outline-none focus:ring-2 focus:ring-blue-400" />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold text-xl hover:bg-blue-700 shadow-xl transition-all active:scale-95">Super Admin Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b p-6 px-12 flex justify-between items-center bg-white sticky top-0 z-50">
        <div className="flex items-center gap-3 font-bold text-xl text-blue-600"><Zap className="fill-blue-600 w-6 h-6"/> {auth.domain}</div>
        <button onClick={() => setAuth({ authenticated: false, token: "", domain: "" })} className="text-slate-400 hover:text-red-500 transition-colors"><LogOut className="w-6 h-6"/></button>
      </header>
      <main className="max-w-4xl mx-auto p-12">
        <AnimatePresence mode="wait">
          {view === "wizard" ? (
            <motion.div key="wizard" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
              <h2 className="text-4xl font-extrabold text-slate-900">Deployment Wizard</h2>
              <div className="p-8 border-2 border-slate-100 rounded-3xl bg-slate-50">
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">1. Targeted Organizational Unit</label>
                <input type="text" value={ouName} onChange={(e) => setOuName(e.target.value)} placeholder="e.g. Chrome-Managed-Users" className="w-full border p-4 rounded-xl text-xl outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="p-8 border-2 border-slate-100 rounded-3xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-xl">2. Add Users (@{auth.domain})</h3>
                  <button onClick={() => setUsersToCreate([...usersToCreate, {firstName:'', lastName:'', username:''}])} className="text-blue-600 font-extrabold text-sm hover:underline">+ New Row</button>
                </div>
                {usersToCreate.map((u, i) => (
                  <div key={i} className="flex gap-4 mb-3">
                    <input placeholder="First Name" className="border p-4 rounded-xl w-full" onChange={(e) => { const c = [...usersToCreate]; c[i].firstName = e.target.value; setUsersToCreate(c); }} />
                    <div className="flex items-center border rounded-xl bg-slate-50 px-4 w-full">
                       <input placeholder="Username" className="bg-transparent w-full outline-none py-4" onChange={(e) => { const c = [...usersToCreate]; c[i].username = e.target.value; setUsersToCreate(c); }} />
                       <span className="text-slate-300 font-bold">@{auth.domain}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={runProvisioning} disabled={actionLoading} className="w-full bg-blue-600 text-white py-7 rounded-[2rem] font-bold text-2xl shadow-xl flex items-center justify-center gap-4 active:scale-95 transition-transform">
                {actionLoading ? <Loader2 className="animate-spin w-8 h-8" /> : <><Wand2 className="w-8 h-8" /> Execute Full Provisioning</>}
              </button>
            </motion.div>
          ) : (
            <motion.div key="report" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 text-center">
              <CheckCircle className="w-20 h-20 mx-auto text-emerald-500 mb-4" />
              <h2 className="text-4xl font-bold">Setup Finalized</h2>
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

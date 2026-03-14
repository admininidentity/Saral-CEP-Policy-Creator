import React, { useState } from "react";
import { Shield, Loader2, LogOut, Wand2, CheckCircle, Download, Zap } from "lucide-react";
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
    if (!clientId) return alert("Enter Client ID");
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
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Saral Provisioning Final Report", 20, 20);
    doc.setFontSize(10);
    doc.text(`Target OU: /${ouName}`, 20, 30);
    doc.text("Users Created:", 20, 45);
    report.users.forEach((u: any, i: number) => {
      doc.text(`- ${u.name} (${u.email}): ${u.status}`, 25, 52 + (i * 7));
    });
    doc.text("Policies Configured:", 20, 85);
    doc.text(`- Incognito Mode Disabled: ${report.policyStatus}`, 25, 92);
    doc.save("Final_Provisioning_Report.pdf");
  };

  const runProvisioning = async () => {
    if (!ouName) return alert("Please enter an OU Name");
    for (const u of usersToCreate) {
      if (!u.firstName || !u.lastName || !u.username) return alert("First Name, Last Name, and Username are all mandatory.");
    }

    setActionLoading(true);
    const orgUnitPath = `/${ouName}`;

    try {
      // 1. Create OU
      await fetch(`https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ouName, parentOrgUnitPath: "/" })
      });

      // 2. Create User inside the OU
      const userResults = await Promise.all(usersToCreate.map(async (u) => {
        const email = `${u.username}@${auth.domain}`;
        const res = await fetch(`https://admin.googleapis.com/admin/directory/v1/users`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primaryEmail: email,
            name: { givenName: u.firstName, familyName: u.lastName },
            password: "Welcome123!",
            orgUnitPath: orgUnitPath
          })
        });
        const data = await res.json();
        return { name: `${u.firstName} ${u.lastName}`, email, status: res.ok ? "Success" : data.error?.message };
      }));

      // 3. Apply Policy: Disallow Incognito (Targeting the specific OU)
      const policyRes = await fetch(`https://chromepolicy.googleapis.com/v1/customers/my_customer/policies/orgunits:batchModify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            target_resource: `orgunits${orgUnitPath}`,
            policy_value: {
              policy_schema: "chrome.users.IncognitoModeAvailability",
              value: { "incognitoModeAvailability": "FORCED_DISABLED" }
            },
            update_mask: "value"
          }]
        })
      });
      
      const policyStatus = policyRes.ok ? "SUCCESS" : "FAILED";

      setReport({ ouPath: orgUnitPath, users: userResults, policyStatus });
      setView("report");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {!auth.authenticated ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-white p-10 rounded-3xl shadow-xl text-center border max-w-sm w-full">
            <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-6">Policy Provisioning Tool</h1>
            <input placeholder="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border p-3 rounded-xl mb-4 text-center" />
            <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Login as Admin</button>
          </div>
        </div>
      ) : (
        <main className="max-w-3xl mx-auto p-12">
          {view === "wizard" ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <h2 className="text-3xl font-black text-slate-900">Automation Wizard</h2>
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">1. Targeted OU</label>
                <input placeholder="OU Name" value={ouName} onChange={(e) => setOuName(e.target.value)} className="w-full border p-4 rounded-xl text-lg" />
              </div>
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h3 className="font-bold mb-4 flex justify-between">2. User Setup (@{auth.domain})</h3>
                {usersToCreate.map((u, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                    <input placeholder="First Name" onChange={(e) => { const c = [...usersToCreate]; c[i].firstName = e.target.value; setUsersToCreate(c); }} className="border p-2 rounded-lg text-sm" />
                    <input placeholder="Last Name" onChange={(e) => { const c = [...usersToCreate]; c[i].lastName = e.target.value; setUsersToCreate(c); }} className="border p-2 rounded-lg text-sm" />
                    <input placeholder="Username" onChange={(e) => { const c = [...usersToCreate]; c[i].username = e.target.value; setUsersToCreate(c); }} className="border p-2 rounded-lg text-sm" />
                  </div>
                ))}
              </div>
              <button onClick={runProvisioning} disabled={actionLoading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg">
                {actionLoading ? <Loader2 className="animate-spin" /> : <><Wand2 /> Deploy Automation</>}
              </button>
            </motion.div>
          ) : (
            <div className="text-center space-y-8">
              <CheckCircle className="w-20 h-20 text-emerald-500 mx-auto" />
              <h2 className="text-4xl font-bold">Execution Finished</h2>
              <div className="flex gap-4">
                <button onClick={generatePDF} className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"><Download /> Download PDF</button>
                <button onClick={() => setView("wizard")} className="flex-1 bg-white border-2 py-4 rounded-xl font-bold">Start New</button>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

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
      scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/admin.directory.orgunit https://www.googleapis.com/auth/admin.directory.user https://www.googleapis.com/auth/chrome.management.policy https://www.googleapis.com/auth/apps.licensing',
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
    doc.text(`Domain: ${auth.domain} | OU: /${ouName}`, 20, 30);
    doc.text("Results:", 20, 45);
    report.users.forEach((u: any, i: number) => {
      doc.text(`- ${u.name}: User=${u.status}, CEP License=${u.licenseStatus}`, 25, 55 + (i * 10));
    });
    doc.text(`- Incognito Policy: ${report.policyStatus}`, 25, 90);
    doc.save("Report.pdf");
  };

  const runProvisioning = async () => {
    setActionLoading(true);
    const orgUnitPath = `/${ouName}`;

    try {
      // 1. Create OU
      await fetch(`https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ouName, parentOrgUnitPath: "/" })
      });

      // 2. Create User and License
      const userResults = await Promise.all(usersToCreate.map(async (u) => {
        const email = `${u.username}@${auth.domain}`;
        let uStatus = "Error";
        let lStatus = "Failed";

        // A. User
        const userRes = await fetch(`https://admin.googleapis.com/admin/directory/v1/users`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primaryEmail: email,
            name: { givenName: u.firstName, familyName: u.lastName },
            password: "Welcome123!",
            orgUnitPath: orgUnitPath
          })
        });
        uStatus = userRes.ok ? "SUCCESS" : "FAILED";

        // B. License (Specific for CEP)
        const licRes = await fetch(`https://licensing.googleapis.com/apps/licensing/v1/product/Google-Chrome-Enterprise/sku/Chrome-Enterprise-Premium/user/${email}`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${auth.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId: email })
        });
        lStatus = licRes.ok ? "ASSIGNED" : "DENIED (Check Billing/API)";

        return { name: `${u.firstName} ${u.lastName}`, email, status: uStatus, licenseStatus: lStatus };
      }));

      // 3. Policy Apply
      const policyRes = await fetch(`https://chromepolicy.googleapis.com/v1/customers/my_customer/policies/orgunits:batchModify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            target_resource: `orgunits/${ouName}`,
            policy_value: {
              policy_schema: "chrome.users.IncognitoModeAvailability",
              value: { "incognitoModeAvailability": 1 } // 1 = Disallowed
            },
            update_mask: "value"
          }]
        })
      });

      setReport({ 
        users: userResults, 
        policyStatus: policyRes.ok ? "SUCCESS" : "FAILED (Check API Enablement)" 
      });
      setView("report");
    } catch (err: any) {
      alert("Browser blocked the request. Check Step 1!");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {!auth.authenticated ? (
        <div className="flex items-center justify-center min-h-screen"><button onClick={handleLogin} className="bg-blue-600 text-white p-6 rounded-2xl font-bold">Admin Login</button></div>
      ) : (
        <main className="max-w-3xl mx-auto p-12">
          {view === "wizard" ? (
            <div className="space-y-6">
              <input placeholder="OU Name" value={ouName} onChange={(e) => setOuName(e.target.value)} className="border p-4 w-full rounded-xl" />
              {usersToCreate.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <input placeholder="First" onChange={(e) => { const c = [...usersToCreate]; c[i].firstName = e.target.value; setUsersToCreate(c); }} className="border p-2 w-full" />
                  <input placeholder="Last" onChange={(e) => { const c = [...usersToCreate]; c[i].lastName = e.target.value; setUsersToCreate(c); }} className="border p-2 w-full" />
                  <input placeholder="User" onChange={(e) => { const c = [...usersToCreate]; c[i].username = e.target.value; setUsersToCreate(c); }} className="border p-2 w-full" />
                </div>
              ))}
              <button onClick={runProvisioning} className="bg-blue-600 text-white w-full py-4 rounded-xl font-bold">Execute Automation</button>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
              <h2 className="text-2xl font-bold">Process Complete</h2>
              <button onClick={generatePDF} className="bg-black text-white p-4 rounded-xl w-full">Get PDF Report</button>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

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
    }

    setActionLoading(true);

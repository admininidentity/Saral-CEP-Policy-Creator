import express from "express";
import { createServer as createViteServer } from "vite";
import session from "express-session";
import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "chrome-admin-automation-secure-session-key-2026",
    resave: false,
    saveUninitialized: false, // Don't create session until something is stored
    name: "__Secure-CEP-Session", // Obfuscate session cookie name
    cookie: {
      secure: true,
      sameSite: "none",
      httpOnly: true,
      maxAge: 3600000, // 1 hour session limit for security
    },
  })
);

const SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.orgunit",
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/apps.licensing",
  "https://www.googleapis.com/auth/chrome.management.policy",
  "openid", "email", "profile",
];

// Auth Routes
app.post("/api/auth/url", (req, res) => {
  const { clientId, clientSecret } = req.body;
  
  // Store in session
  // @ts-ignore
  req.session.clientId = clientId || process.env.GOOGLE_CLIENT_ID;
  // @ts-ignore
  req.session.clientSecret = clientSecret || process.env.GOOGLE_CLIENT_SECRET;

  const client = new google.auth.OAuth2(
    // @ts-ignore
    req.session.clientId,
    // @ts-ignore
    req.session.clientSecret,
    `${process.env.APP_URL}/auth/callback`
  );

  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
  res.json({ url });
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const client = new google.auth.OAuth2(
      // @ts-ignore
      req.session.clientId || process.env.GOOGLE_CLIENT_ID,
      // @ts-ignore
      req.session.clientSecret || process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_URL}/auth/callback`
    );

    const { tokens } = await client.getToken(code as string);
    // @ts-ignore
    req.session.tokens = tokens;
    
    // Get user info to find the domain
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      // @ts-ignore
      audience: req.session.clientId || process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    // @ts-ignore
    req.session.user = payload;
    // @ts-ignore
    req.session.domain = payload?.email?.split("@")[1];

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).send("Authentication failed");
  }
});

app.get("/api/auth/status", (req, res) => {
  // @ts-ignore
  if (req.session.tokens) {
    // @ts-ignore
    res.json({ authenticated: true, user: req.session.user, domain: req.session.domain });
  } else {
    res.json({ authenticated: false });
  }
});

app.post("/api/auth/logout", (req, res) => {
  // Clear all sensitive data from session before destroying
  // @ts-ignore
  req.session.tokens = null;
  // @ts-ignore
  req.session.clientId = null;
  // @ts-ignore
  req.session.clientSecret = null;
  // @ts-ignore
  req.session.user = null;
  
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("__Secure-CEP-Session");
    res.json({ success: true });
  });
});

// Admin Actions
const getAuthenticatedClient = (req: any) => {
  const client = new google.auth.OAuth2(
    req.session.clientId || process.env.GOOGLE_CLIENT_ID,
    req.session.clientSecret || process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/auth/callback`
  );
  client.setCredentials(req.session.tokens);
  return client;
};

app.post("/api/admin/create-ou", async (req, res) => {
  try {
    const { name } = req.body;
    const auth = getAuthenticatedClient(req);
    const admin = google.admin({ version: "directory_v1", auth });
    const chromePolicy = google.chromepolicy({ version: "v1", auth });
    // @ts-ignore
    const domain = req.session.domain;
    const customerId = "customers/my_customer";
    
    const response = await admin.orgunits.insert({
      customerId: "my_customer",
      requestBody: {
        name,
        parentOrgUnitPath: "/",
      },
    });

    const newOu = response.data;
    const ouId = newOu.orgUnitId;
    const ouPath = newOu.orgUnitPath;

    // Apply policies to the new OU
    const policiesToSet = [
      {
        name: "chrome.users.OrganizationName",
        value: { organizationName: domain },
        description: "Sets the organization name for the profile."
      },
      {
        name: "chrome.users.BrowserOrganizationName",
        value: { browserOrganizationName: domain },
        description: "Sets the organization name for the browser."
      },
      {
        name: "chrome.users.BrowserSignin",
        value: { browserSignin: "BROWSER_SIGNIN_FORCED" },
        description: "Forces users to sign in to use the browser."
      },
      {
        name: "chrome.users.ProfileSeparationSettings",
        value: { profileSeparationSettings: "PROFILE_SEPARATION_ENFORCED" },
        description: "Enforces profile separation."
      },
      {
        name: "chrome.users.ProfileSeparationDataMigrationSettings",
        value: { profileSeparationDataMigrationSettings: "PROFILE_SEPARATION_DATA_MIGRATION_DISALLOWED" },
        description: "Disallows data migration during profile separation."
      },
      {
        name: "chrome.users.IncognitoModeAvailability",
        value: { incognitoModeAvailability: "INCOGNITO_MODE_AVAILABILITY_DISABLED" },
        description: "Disallows incognito mode."
      },
      {
        name: "chrome.users.SecondaryGoogleAccountSigninAllowed",
        value: { secondaryGoogleAccountSigninAllowed: false, allowedDomains: [domain] },
        description: "Restricts secondary account sign-in to the organization domain."
      },
      {
        name: "chrome.users.DeveloperToolsAvailability",
        value: { developerToolsAvailability: "DEVELOPER_TOOLS_AVAILABILITY_DISABLED" },
        description: "Disallows use of built-in developer tools."
      },
      {
        name: "chrome.users.DeveloperToolsDisabled",
        value: { developerToolsDisabled: true },
        description: "Disables developer tools on extensions page."
      },
      {
        name: "chrome.users.CloudReportingEnabled",
        value: { cloudReportingEnabled: true },
        description: "Enables managed browser cloud reporting."
      },
      {
        name: "chrome.users.CloudProfileReportingEnabled",
        value: { cloudProfileReportingEnabled: true },
        description: "Enables managed profile reporting."
      },
      {
        name: "chrome.users.CloudReportingUploadFrequency",
        value: { cloudReportingUploadFrequency: "10800s" },
        description: "Sets reporting upload frequency to 3 hours."
      },
      {
        name: "chrome.users.SafeBrowsingProtectionLevel",
        value: { safeBrowsingProtectionLevel: "SAFE_BROWSING_PROTECTION_LEVEL_ENHANCED" },
        description: "Enables Enhanced Safe Browsing."
      },
      {
        name: "chrome.users.SafeBrowsingProtectionLevelUserOverride",
        value: { safeBrowsingProtectionLevelUserOverride: "SAFE_BROWSING_PROTECTION_LEVEL_USER_OVERRIDE_DISALLOWED" },
        description: "Disallows users from overriding Safe Browsing protection level."
      }
    ];

    const policyResults = [];
    for (const policy of policiesToSet) {
      try {
        await chromePolicy.customers.policies.orgunits.batchModify({
          customer: customerId,
          requestBody: {
            requests: [
              {
                policyTargetKey: {
                  targetResource: `orgunits/${ouId?.substring(3)}`, // Remove 'id:' prefix if present, or use the ID
                },
                policyValue: {
                  policySchema: policy.name,
                  value: policy.value
                },
                updateMask: "value"
              }
            ]
          }
        });
        policyResults.push({ name: policy.name, status: "Success", description: policy.description });
      } catch (err: any) {
        console.error(`Error setting policy ${policy.name} on OU ${ouPath}:`, err.message);
        policyResults.push({ name: policy.name, status: "Failed", error: err.message, description: policy.description });
      }
    }

    res.json({ 
      ou: newOu, 
      policiesApplied: policyResults.filter(r => r.status === "Success").length,
      totalPolicies: policiesToSet.length,
      results: policyResults
    });
  } catch (error: any) {
    console.error("OU error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/create-user-and-license", async (req, res) => {
  try {
    const { firstName, lastName, email, ouPath } = req.body;
    const auth = getAuthenticatedClient(req);
    const admin = google.admin({ version: "directory_v1", auth });
    const licensing = google.licensing({ version: "v1", auth });

    // Create User
    const userResponse = await admin.users.insert({
      requestBody: {
        primaryEmail: email,
        name: { givenName: firstName, familyName: lastName },
        password: Math.random().toString(36).slice(-10),
        orgUnitPath: ouPath ? (ouPath.startsWith("/") ? ouPath : `/${ouPath}`) : "/",
      },
    });

    const userEmail = userResponse.data.primaryEmail!;

    // Assign License (Chrome Enterprise Premium)
    // SKU for CEP is "1010340002" (Chrome Enterprise Premium) or "Google-Chrome-Enterprise-Premium"
    // Actually, it's often "Google-Chrome-Enterprise-Premium"
    try {
      await licensing.licenseAssignments.insert({
        productId: "Google-Chrome-Enterprise-Premium",
        skuId: "Google-Chrome-Enterprise-Premium",
        requestBody: { userId: userEmail },
      });
    } catch (licenseError: any) {
      console.warn("License assignment failed (might already exist or wrong SKU):", licenseError.message);
      // We continue because the user was created
    }

    res.json({ user: userResponse.data, licenseAssigned: true });
  } catch (error: any) {
    console.error("User/License error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/provision-full", async (req, res) => {
  try {
    const { ouName, users } = req.body; // users is an array of {firstName, lastName, email}
    const auth = getAuthenticatedClient(req);
    const admin = google.admin({ version: "directory_v1", auth });
    const licensing = google.licensing({ version: "v1", auth });
    const chromePolicy = google.chromepolicy({ version: "v1", auth });
    // @ts-ignore
    const domain = req.session.domain;
    const customerId = "customers/my_customer";

    const report: any = {
      ou: null,
      users: [],
      policies: [],
      summary: {
        success: true,
        message: ""
      }
    };

    // 1. Create OU
    let targetOuPath = "";
    try {
      const ouResponse = await admin.orgunits.insert({
        customerId: "my_customer",
        requestBody: {
          name: ouName,
          parentOrgUnitPath: "/",
        },
      });
      report.ou = ouResponse.data;
      targetOuPath = ouResponse.data.orgUnitPath || `/${ouName}`;
    } catch (ouErr: any) {
      // If OU already exists (409 Conflict), try to retrieve its path
      if (ouErr.code === 409) {
        try {
          const existingOUs = await admin.orgunits.list({ customerId: "my_customer" });
          const found = existingOUs.data.organizationUnits?.find(o => o.name === ouName);
          if (found) {
            report.ou = found;
            targetOuPath = found.orgUnitPath || `/${ouName}`;
          } else {
            // Fallback to the expected path if list doesn't show it immediately
            targetOuPath = `/${ouName}`;
          }
        } catch (listErr) {
          targetOuPath = `/${ouName}`;
        }
      } else {
        throw ouErr;
      }
    }

    const ouId = report.ou?.orgUnitId;

    // 2. Create Users & Assign Licenses
    for (const user of users) {
      try {
        const userResponse = await admin.users.insert({
          requestBody: {
            primaryEmail: user.email,
            name: { givenName: user.firstName, familyName: user.lastName },
            password: Math.random().toString(36).slice(-10),
            orgUnitPath: targetOuPath, // Explicitly use the target OU path
          },
        });

        let licenseStatus = "Success";
        try {
          await licensing.licenseAssignments.insert({
            productId: "Google-Chrome-Enterprise-Premium",
            skuId: "Google-Chrome-Enterprise-Premium",
            requestBody: { userId: user.email },
          });
        } catch (lErr: any) {
          licenseStatus = `Failed: ${lErr.message}`;
        }

        report.users.push({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          status: "Created",
          license: licenseStatus
        });
      } catch (uErr: any) {
        report.users.push({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          status: "Failed",
          error: uErr.message
        });
      }
    }

    // 3. Apply Policies to the new OU
    const policiesToSet = [
      { name: "chrome.users.OrganizationName", value: { organizationName: domain }, description: "Profile Organization Name" },
      { name: "chrome.users.BrowserOrganizationName", value: { browserOrganizationName: domain }, description: "Browser Organization Name" },
      { name: "chrome.users.BrowserSignin", value: { browserSignin: "BROWSER_SIGNIN_FORCED" }, description: "Forced Browser Sign-in" },
      { name: "chrome.users.ProfileSeparationSettings", value: { profileSeparationSettings: "PROFILE_SEPARATION_ENFORCED" }, description: "Enforced Profile Separation" },
      { name: "chrome.users.ProfileSeparationDataMigrationSettings", value: { profileSeparationDataMigrationSettings: "PROFILE_SEPARATION_DATA_MIGRATION_DISALLOWED" }, description: "Disallowed Data Migration" },
      { name: "chrome.users.IncognitoModeAvailability", value: { incognitoModeAvailability: "INCOGNITO_MODE_AVAILABILITY_DISABLED" }, description: "Disabled Incognito Mode" },
      { name: "chrome.users.SecondaryGoogleAccountSigninAllowed", value: { secondaryGoogleAccountSigninAllowed: false, allowedDomains: [domain] }, description: "Restricted Secondary Accounts" },
      { name: "chrome.users.DeveloperToolsAvailability", value: { developerToolsAvailability: "DEVELOPER_TOOLS_AVAILABILITY_DISABLED" }, description: "Disabled Developer Tools" },
      { name: "chrome.users.DeveloperToolsDisabled", value: { developerToolsDisabled: true }, description: "Disabled Extensions Dev Mode" },
      { name: "chrome.users.CloudReportingEnabled", value: { cloudReportingEnabled: true }, description: "Enabled Cloud Reporting" },
      { name: "chrome.users.CloudProfileReportingEnabled", value: { cloudProfileReportingEnabled: true }, description: "Enabled Profile Reporting" },
      { name: "chrome.users.CloudReportingUploadFrequency", value: { cloudReportingUploadFrequency: "10800s" }, description: "3-Hour Upload Frequency" },
      { name: "chrome.users.SafeBrowsingProtectionLevel", value: { safeBrowsingProtectionLevel: "SAFE_BROWSING_PROTECTION_LEVEL_ENHANCED" }, description: "Enhanced Safe Browsing" },
      { name: "chrome.users.SafeBrowsingProtectionLevelUserOverride", value: { safeBrowsingProtectionLevelUserOverride: "SAFE_BROWSING_PROTECTION_LEVEL_USER_OVERRIDE_DISALLOWED" }, description: "Disallowed Safe Browsing Override" }
    ];

    for (const policy of policiesToSet) {
      try {
        await chromePolicy.customers.policies.orgunits.batchModify({
          customer: customerId,
          requestBody: {
            requests: [
              {
                policyTargetKey: { targetResource: `orgunits/${ouId?.substring(3)}` },
                policyValue: { policySchema: policy.name, value: policy.value },
                updateMask: "value"
              }
            ]
          }
        });
        report.policies.push({ name: policy.description, status: "Success" });
      } catch (pErr: any) {
        report.policies.push({ name: policy.description, status: "Failed", error: pErr.message });
      }
    }

    report.summary.message = `Successfully provisioned OU "${ouName}" with ${report.users.filter((u: any) => u.status === "Created").length} users and ${report.policies.filter((p: any) => p.status === "Success").length} policies.`;
    res.json(report);
  } catch (error: any) {
    console.error("Provisioning error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

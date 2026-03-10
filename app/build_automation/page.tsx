"use client";

import { useState, useEffect } from "react";

const BUILD_OPTIONS = [
  {
    id: 1,
    label: "Change Version Code",
    action: "",
    description: "Update the app version code",
    icon: "🔢",
  },
  {
    id: 2,
    label: "Create the Build (APK)",
    action: "build_apk",
    description: "Generate a release APK",
    icon: "📦",
  },
  {
    id: 3,
    label: "Create Build & Upload to Firebase",
    action: "build_apk_firebase",
    description: "Build APK and distribute via Firebase",
    icon: "🔥",
  },
  {
    id: 4,
    label: "Create Bundle (AAB)",
    action: "build_aab",
    description: "Generate an Android App Bundle",
    icon: "📱",
  },
  {
    id: 5,
    label: "Create Bundle & Upload to Play Store (Internal)",
    action: "build_aab_playstore",
    description: "Build AAB and upload to internal testing track",
    icon: "🚀",
  },
  {
    id: 6,
    label: "Create Bundle & Upload to Play Store (Beta)",
    action: "build_aab_beta",
    description: "Build AAB and upload to beta testing track",
    icon: "🧪",
  },
];

export default function BuildAutomationPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [token, setToken] = useState("");
  const [branch, setBranch] = useState("");
  const [selectedAction, setSelectedAction] = useState<number | null>(null);
  const [versionCode, setVersionCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Check if already logged in
  useEffect(() => {
    const session = sessionStorage.getItem("build_auth");
    if (session === "true") {
      setIsAuthenticated(true);
      const savedToken = sessionStorage.getItem("build_token");
      if (savedToken) setToken(savedToken);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (username.trim() && password.trim()) {
      setToken(password);
      sessionStorage.setItem("build_auth", "true");
      sessionStorage.setItem("build_token", password);
      setIsAuthenticated(true);
    } else {
      setLoginError("Please enter both username and password.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("build_auth");
    sessionStorage.removeItem("build_token");
    setUsername("");
    setPassword("");
    setToken("");
  };

  const handleTriggerPipeline = async () => {
    if (!token.trim()) {
      setResult({ success: false, message: "Please enter your pipeline token." });
      return;
    }
    if (!branch.trim()) {
      setResult({ success: false, message: "Please enter a branch name." });
      return;
    }
    if (selectedAction === null) {
      setResult({ success: false, message: "Please select a build action." });
      return;
    }

    const option = BUILD_OPTIONS.find((o) => o.id === selectedAction);
    if (!option) {
      setResult({
        success: false,
        message: "Selected action is not available for pipeline trigger.",
      });
      return;
    }

    // Validate version code when "Change Version Code" is selected
    if (selectedAction === 1 && !versionCode.trim()) {
      setResult({ success: false, message: "Please enter a new version code." });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("token", token);
      formData.append("ref", branch);

      if (selectedAction === 1) {
        // Version code change
        formData.append("variables[NEW_VERSION_CODE]", versionCode);
        formData.append("variables[BUMP_VERSION]", "true");
      } else {
        // Build actions
        formData.append("variables[BUILD_ACTION]", option.action);
      }

      const response = await fetch(
        "https://scm.intermesh.net/api/v4/projects/624/trigger/pipeline",
        {
          method: "POST",
          body: formData,
        }
      );
      console.log(response)
      if (response.ok) {
        const data = await response.json();
        console.log(data)
        setResult({
          success: true,
          message: `Pipeline triggered successfully! Pipeline ID: ${data.id ?? "N/A"}, Status: ${data.status ?? "created"}`,
        });
      } else {
        const errorText = await response.text();
        setResult({
          success: false,
          message: `Failed to trigger pipeline (${response.status}): ${errorText}`,
        });
      }
    } catch (err) {
      setResult({
        success: false,
        message: `Network error: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // ─── LOGIN PAGE ───
  if (!isAuthenticated) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 50%, #dfe6f6 100%)" }}
      >
        <div className="card shadow-lg border-0" style={{ width: "100%", maxWidth: 420, borderRadius: 16 }}>
          <div className="card-body p-5">
            <div className="text-center mb-4">
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #667eea, #764ba2)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  color: "#fff",
                  marginBottom: 12,
                }}
              >
                ⚙
              </div>
              <h3 className="fw-bold" style={{ color: "#1a1a2e" }}>
                Build Automation
              </h3>
              <p className="text-muted small">Sign in to access the pipeline dashboard</p>
            </div>

            {loginError && (
              <div className="alert alert-danger py-2 small">{loginError}</div>
            )}

            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label className="form-label fw-semibold small">Username</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="form-label fw-semibold small">Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn w-100 text-white fw-semibold"
                style={{
                  background: "linear-gradient(135deg, #667eea, #764ba2)",
                  border: "none",
                  padding: "10px 0",
                  borderRadius: 8,
                }}
              >
                Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD PAGE ───
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 50%, #dfe6f6 100%)",
        color: "#333",
      }}
    >
      {/* Navbar */}
      <nav
        className="d-flex align-items-center justify-content-between px-4 py-3 shadow-sm"
        style={{ background: "#fff" }}
      >
        <h5 className="mb-0 fw-bold" style={{ color: "#1a1a2e" }}>⚙ Build Automation Dashboard</h5>
        <button className="btn btn-outline-dark btn-sm" onClick={handleLogout}>
          Logout
        </button>
      </nav>

      <div className="container py-4" style={{ maxWidth: 900 }}>
        {/* Token & Branch */}
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 12, background: "#fff" }}>
          <div className="card-body p-4">
            <h6 className="fw-bold mb-3" style={{ color: "#4f46e5" }}>
              Pipeline Configuration
            </h6>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Branch</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. main, develop, feature/xyz"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Build Actions */}
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 12, background: "#fff" }}>
          <div className="card-body p-4">
            <h6 className="fw-bold mb-3" style={{ color: "#4f46e5" }}>
              Select Build Action
            </h6>
            <div className="row g-3">
              {BUILD_OPTIONS.map((option) => (
                <div className="col-md-6" key={option.id}>
                  <div
                    className="p-3 rounded-3 h-100"
                    onClick={() => setSelectedAction(option.id)}
                    style={{
                      background:
                        selectedAction === option.id
                          ? "linear-gradient(135deg, #667eea, #764ba2)"
                          : "#f8f9fc",
                      color: selectedAction === option.id ? "#fff" : "#333",
                      border:
                        selectedAction === option.id
                          ? "2px solid #667eea"
                          : "2px solid #e2e8f0",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div className="d-flex align-items-start gap-3">
                      <span style={{ fontSize: 28 }}>{option.icon}</span>
                      <div>
                        <div className="fw-semibold">{option.label}</div>
                        <small style={{ opacity: 0.7 }}>
                          {option.description}
                        </small>
                        {option.action && (
                          <div className="mt-1">
                            <span
                              className="badge"
                              style={{
                                background: selectedAction === option.id ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                                color: selectedAction === option.id ? "#fff" : "#555",
                                fontSize: 10,
                              }}
                            >
                              {option.action}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Version Code Input (shown when option 1 is selected) */}
        {selectedAction === 1 && (
          <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 12, background: "#fff" }}>
            <div className="card-body p-4">
              <h6 className="fw-bold mb-3" style={{ color: "#4f46e5" }}>
                Version Code
              </h6>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">New Version Code</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 101, 2.0.1"
                    value={versionCode}
                    onChange={(e) => setVersionCode(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trigger Button */}
        <div className="text-center mb-4">
          <button
            className="btn btn-lg text-white fw-semibold px-5"
            style={{
              background: "linear-gradient(135deg, #667eea, #764ba2)",
              border: "none",
              borderRadius: 10,
              opacity: loading ? 0.7 : 1,
            }}
            onClick={handleTriggerPipeline}
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                ></span>
                Triggering Pipeline...
              </>
            ) : (
              "Trigger Pipeline"
            )}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`alert ${result.success ? "alert-success" : "alert-danger"}`}
            style={{ borderRadius: 10 }}
          >
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}

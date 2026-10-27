
// ============================================================================
// Login screen and sign-in flow (design copied from the InsightHub login, branded "Commercial Portal").
// In production the button starts Google sign-in (OIDC, restricted to the Bosta domain) and the server returns the verified email;
// the email is mapped to an employee (app.user_access) and the rest of the app only offers that person's scope.
// In this prototype the Google step is simulated: you type your Bosta email and it is checked against the access list built from the emails of the
// targets sheet (the file holds SHA-256 hashes of the emails, never the addresses). The hashing only keeps the addresses out of the file; the real check is server-side.
// A host app that already authenticated the user can pass <TargetTracker session={{ viewerKey, name }} onSignOut={...} /> and skip this screen.
// ============================================================================
// Login and permissions are switched OFF for now: the app opens straight on the VP view with every level available.
// Set AUTH_ENABLED to true to bring the login screen and the access levels back (docs/ACCESS.md).
const AUTH_ENABLED = false;
const AUTH_DOMAIN = "bosta.co";
const ACCESS_KEYS = __P.access || {};   // {sha256(email): access key} from the payload (only used when AUTH_ENABLED)
function sha256Hex(str) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes = Array.from(unescape(encodeURIComponent(str))).map((c) => c.charCodeAt(0));
  const l = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i * 8)) & 255);
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < bytes.length; o += 64) {
    const w = []; for (let i = 0; i < 16; i++) w[i] = (bytes[o + 4 * i] << 24) | (bytes[o + 4 * i + 1] << 16) | (bytes[o + 4 * i + 2] << 8) | bytes[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) { const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) { const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K[i] + w[i]) | 0, S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0; hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0; }
    h = [h[0] + a, h[1] + b, h[2] + c, h[3] + d, h[4] + e, h[5] + f, h[6] + g, h[7] + hh].map((x) => x | 0);
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
const AUTH_FONT = "'Lato', 'Helvetica Neue', Arial, sans-serif";
const AUTH_MESSAGES = {
  signedOut: "You\u2019re signed out.",
  domain: "Please sign in with your Bosta Google account (@" + AUTH_DOMAIN + ").",
  noAccess: "This account doesn\u2019t have access to Commercial Portal yet. Ask your manager to request access.",
  invalid: "Enter your Bosta email address.",
};
function authAccounts() {
  const acc = [{ key: "vp", name: ORG.vp.name, role: "VP", access: "Every team" }];
  ORG.heads.forEach((h) => acc.push({ key: "h:" + h.id, name: h.name, role: "Head", access: LEAD_TAB_LABEL[h.team] + " team" }));
  ORG.tls.forEach((t) => acc.push({ key: "t:" + t.id, name: t.name, role: "Team Leader", access: "Own team: AMs and sales" }));
  ORG.ams.forEach((a) => acc.push({ key: "a:" + a.name, name: a.name, role: "Account Manager", access: "Own view only" }));
  ORG.sales.forEach((s) => acc.push({ key: "s:" + s.id, name: s.name, role: "Sales Manager", access: "Own view only" }));
  return acc;
}
// the email typed in the (simulated) Google step -> the account it belongs to, or a refusal marker
function authResolve(email) {
  const e = (email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { key: "invalid" };
  if (!e.endsWith("@" + AUTH_DOMAIN)) return { key: "external" };
  const k = ACCESS_KEYS[sha256Hex(e)];
  const acc = k ? authAccounts().find((a) => a.key === k) : null;
  return acc || { key: "noaccess" };
}
// the decision after Google returns an account: wrong domain, no access, or a session with its access level
function authorize(account) {
  if (account.key === "invalid") return { ok: false, message: AUTH_MESSAGES.invalid };
  if (account.key === "external") return { ok: false, message: AUTH_MESSAGES.domain };
  if (account.key === "noaccess") return { ok: false, message: AUTH_MESSAGES.noAccess };
  return { ok: true, session: { viewerKey: account.key, name: account.name, role: account.role, access: account.access } };
}
const AUTH_DEFAULT_SESSION = { viewerKey: "vp", name: "Sameh Shaheen", role: "VP", access: "Every team" };
function authRoleOf(session) { return session.role + " \u00b7 " + session.access; }

function GoogleG() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
function LoginScreen({ message, onAccount }) {
  const [picker, setPicker] = useState(false);
  const [email, setEmail] = useState("");
  const isError = message && message !== AUTH_MESSAGES.signedOut;
  const submit = () => { setPicker(false); const e = email; setEmail(""); onAccount(authResolve(e)); };
  return (
    <div style={{ background: "#FAFAFA", minHeight: "100vh", fontFamily: AUTH_FONT, color: "#2B3F3A", display: "flex", justifyContent: "center", boxSizing: "border-box", padding: "0 20px" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" />
      <div style={{ width: "100%", maxWidth: 380, paddingTop: "13vh", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 62 }}>
          <span style={{ color: "#E8321F", fontSize: 50, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>bosta</span>
          <span style={{ width: 1, height: 34, background: "#D8DCDB" }} />
          <span style={{ fontSize: 26, fontWeight: 700, color: "#2B3F3A", letterSpacing: "-0.01em" }}>Commercial Portal</span>
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 14 }}>Welcome back</div>
        <div style={{ fontSize: 15.5, color: "#7A8885", marginBottom: 40 }}>Sign in with your Bosta Google account.</div>
        <button onClick={() => setPicker(true)} style={{ width: "100%", height: 46, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, background: "#FFFFFF", border: "1px solid #D9DEDD", borderRadius: 6, cursor: "pointer", fontSize: 16.5, color: "#3C4043", fontFamily: "'Roboto', 'Helvetica Neue', Arial, sans-serif" }}>
          <GoogleG /> Continue with Google
        </button>
        {message && (
          <div role="status" style={{ marginTop: 52, padding: "16px 18px", borderRadius: 10, fontSize: 14.5, background: isError ? "#FBF1EF" : "#F0F4F1", color: isError ? "#A24A3C" : "#5A7168" }}>{message}</div>
        )}
      </div>
      {picker && (
        <div onClick={() => setPicker(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,28,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 400, padding: "20px 22px", boxShadow: "0 12px 40px rgba(0,0,0,0.25)", textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Sign in with Google</div>
            <div style={{ fontSize: 12, color: "#7A8885", marginBottom: 14, lineHeight: 1.5 }}>Prototype: type your Bosta email. In production Google verifies it and the portal looks it up in the access list.</div>
            <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder={"name@" + AUTH_DOMAIN} aria-label="Bosta email" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1px solid #D9DEDD", fontSize: 14.5, marginBottom: 14 }} />
            <button onClick={submit} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "#E8321F", color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}

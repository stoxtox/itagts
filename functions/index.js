/**
 * iTag Timestamp Portal — Cloud Functions
 *
 * Functions:
 *   sendOTP          — Generate & email a 6-digit OTP for signup verification
 *   verifyOTP        — Validate an OTP code
 *   sendPasswordReset — Generate branded password-reset email
 *   onUserCreated    — Send welcome email when a new user doc is created
 *   deleteUserData   — Delete all user data + auth account (account deletion)
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { Resend } = require("resend");

const getOtpEmailHtml = require("./emails/otpTemplate");
const getWelcomeEmailHtml = require("./emails/welcomeTemplate");
const getResetEmailHtml = require("./emails/resetTemplate");

admin.initializeApp();
const db = admin.firestore();

const FROM_EMAIL = "iTag Timestamp Portal <noreply@itagts.com>";

// Lazy-initialize Resend client (env vars aren't available during deploy analysis)
let _resend = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// ───────────────────────────────────────────────
//  1. sendOTP — Generate OTP, store, email
// ───────────────────────────────────────────────

exports.sendOTP = onCall({ region: "us-central1" }, async (request) => {
  const { email, name } = request.data || {};

  // Validate
  if (!email || typeof email !== "string") {
    throw new HttpsError("invalid-argument", "Email is required.");
  }
  const trimmedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new HttpsError("invalid-argument", "Invalid email format.");
  }

  const otpRef = db.collection("otps").doc(trimmedEmail);

  // Rate limit: 1 OTP per email per 60 seconds
  const existing = await otpRef.get();
  if (existing.exists) {
    const data = existing.data();
    const createdAt = data.createdAt?.toDate?.() || new Date(0);
    const secondsSince = (Date.now() - createdAt.getTime()) / 1000;
    if (secondsSince < 60) {
      throw new HttpsError(
        "resource-exhausted",
        `Please wait ${Math.ceil(60 - secondsSince)} seconds before requesting a new code.`
      );
    }
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Store in Firestore
  await otpRef.set({
    code,
    name: name || "",
    expiresAt: admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    ),
    attempts: 0,
    used: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Send email via Resend
  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: trimmedEmail,
      subject: "Your verification code — iTag Timestamp Portal",
      html: getOtpEmailHtml(code, name),
    });
  } catch (err) {
    console.error("[sendOTP] Resend error:", err);
    // Clean up the OTP since email failed
    await otpRef.delete();
    throw new HttpsError("internal", "Failed to send verification email. Please try again.");
  }

  console.log(`[sendOTP] Code sent to ${trimmedEmail}`);
  return { success: true };
});

// ───────────────────────────────────────────────
//  2. verifyOTP — Check code validity
// ───────────────────────────────────────────────

exports.verifyOTP = onCall({ region: "us-central1" }, async (request) => {
  const { email, code } = request.data || {};

  if (!email || !code) {
    throw new HttpsError("invalid-argument", "Email and code are required.");
  }

  const trimmedEmail = email.trim().toLowerCase();
  const otpRef = db.collection("otps").doc(trimmedEmail);
  const snap = await otpRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "No verification code found. Please request a new one.");
  }

  const data = snap.data();

  // Check if already used
  if (data.used) {
    throw new HttpsError("failed-precondition", "This code has already been used. Please request a new one.");
  }

  // Check expiry
  const expiresAt = data.expiresAt?.toDate?.() || new Date(0);
  if (Date.now() > expiresAt.getTime()) {
    throw new HttpsError("deadline-exceeded", "This code has expired. Please request a new one.");
  }

  // Check attempts
  if (data.attempts >= 3) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many failed attempts. Please request a new code."
    );
  }

  // Increment attempts
  await otpRef.update({
    attempts: admin.firestore.FieldValue.increment(1),
  });

  // Check code
  if (data.code !== code.trim()) {
    const remaining = 2 - data.attempts; // already incremented
    throw new HttpsError(
      "permission-denied",
      remaining > 0
        ? `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
        : "Invalid code. Too many attempts — please request a new code."
    );
  }

  // Mark as used
  await otpRef.update({ used: true });

  console.log(`[verifyOTP] Code verified for ${trimmedEmail}`);
  return { success: true };
});

// ───────────────────────────────────────────────
//  3. sendPasswordReset — Branded reset email
// ───────────────────────────────────────────────

exports.sendPasswordReset = onCall({ region: "us-central1" }, async (request) => {
  const { email } = request.data || {};

  if (!email || typeof email !== "string") {
    throw new HttpsError("invalid-argument", "Email is required.");
  }

  const trimmedEmail = email.trim().toLowerCase();

  try {
    // Get the user record (to find name for personalization)
    const userRecord = await admin.auth().getUserByEmail(trimmedEmail);
    let userName = "";

    // Try to get name from Firestore user doc
    try {
      const userDoc = await db.collection("users").doc(userRecord.uid).get();
      if (userDoc.exists) {
        userName = userDoc.data().name || "";
      }
    } catch (_) { /* ignore */ }

    // Generate the password reset link
    const rawLink = await admin.auth().generatePasswordResetLink(trimmedEmail, {
      url: "https://itagts.com/login",
    });

    // Parse the oobCode from Firebase's link and construct our custom URL
    const url = new URL(rawLink);
    const oobCode = url.searchParams.get("oobCode");
    const customLink = oobCode
      ? `https://itagts.com/reset-password?oobCode=${oobCode}`
      : rawLink;

    // Send branded email via Resend
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: trimmedEmail,
      subject: "Reset your password — iTag Timestamp Portal",
      html: getResetEmailHtml(customLink, userName || userRecord.displayName),
    });

    console.log(`[sendPasswordReset] Reset email sent to ${trimmedEmail}`);
  } catch (err) {
    // Don't reveal whether the account exists — always return success
    console.log(`[sendPasswordReset] Error (suppressed): ${err.message}`);
  }

  // Always return success to prevent email enumeration
  return { success: true };
});

// ───────────────────────────────────────────────
//  4. onUserCreated — Welcome email on new user doc
// ───────────────────────────────────────────────

// ───────────────────────────────────────────────
//  5. deleteUserData — Account deletion
// ───────────────────────────────────────────────

exports.deleteUserData = onCall({ region: "us-central1" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Must be signed in to delete account.");
  }

  console.log(`[deleteUserData] Deleting all data for uid: ${uid}`);

  // Helper to delete docs in batches of 500 (Firestore limit)
  const deleteCollection = async (query) => {
    const snap = await query.get();
    if (snap.empty) return 0;

    let count = 0;
    const chunks = [];
    let chunk = [];

    snap.forEach((docSnap) => {
      chunk.push(docSnap.ref);
      if (chunk.length === 499) {
        chunks.push(chunk);
        chunk = [];
      }
    });
    if (chunk.length > 0) chunks.push(chunk);

    for (const refs of chunks) {
      const batch = db.batch();
      refs.forEach((ref) => batch.delete(ref));
      await batch.commit();
      count += refs.length;
    }
    return count;
  };

  // Delete sessions
  const sessionsDeleted = await deleteCollection(
    db.collection("sessions").where("uid", "==", uid)
  );

  // Delete plans
  const plansDeleted = await deleteCollection(
    db.collection("plans").where("uid", "==", uid)
  );

  // Delete OTPs (if any remain)
  // OTPs are keyed by email, so we find the user's email first
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const email = userDoc.data().email;
      if (email) {
        const otpRef = db.collection("otps").doc(email.toLowerCase());
        const otpSnap = await otpRef.get();
        if (otpSnap.exists) await otpRef.delete();
      }
    }
  } catch (_) { /* ignore OTP cleanup errors */ }

  // Delete user document
  await db.collection("users").doc(uid).delete();

  // Delete Firebase Auth account
  await admin.auth().deleteUser(uid);

  console.log(
    `[deleteUserData] Done: ${sessionsDeleted} sessions, ${plansDeleted} plans deleted for ${uid}`
  );

  return { success: true };
});

// ───────────────────────────────────────────────
//  6. onUserCreated — Welcome email on new user doc
// ───────────────────────────────────────────────

exports.onUserCreated = onDocumentCreated(
  { document: "users/{uid}", region: "us-central1" },
  async (event) => {
    const data = event.data?.data();
    if (!data || !data.email) {
      console.log("[onUserCreated] No email in user doc, skipping welcome email.");
      return;
    }

    // Don't send duplicate welcome emails
    if (data.welcomeEmailSent) {
      return;
    }

    try {
      await getResend().emails.send({
        from: FROM_EMAIL,
        to: data.email,
        subject: "Welcome to iTag Timestamp Portal!",
        html: getWelcomeEmailHtml(data.name || data.email.split("@")[0]),
      });

      // Mark as sent to prevent duplicates
      await event.data.ref.update({ welcomeEmailSent: true });

      console.log(`[onUserCreated] Welcome email sent to ${data.email}`);
    } catch (err) {
      console.error("[onUserCreated] Failed to send welcome email:", err);
    }
  }
);

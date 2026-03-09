// src/components/PrivacyPolicyPage.jsx
import React from "react";
import {
  Box, Paper, Typography, Stack, Button
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

const EFFECTIVE_DATE = "March 8, 2026";

const Section = ({ title, children }) => (
  <Box>
    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: "primary.main", mt: 2 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

const P = ({ children }) => (
  <Typography variant="body2" color="text.secondary" paragraph sx={{ lineHeight: 1.7 }}>
    {children}
  </Typography>
);

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        background: (t) =>
          t.palette.mode === "dark"
            ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)"
            : "linear-gradient(135deg, #f5f3ff 0%, #e0e7ff 50%, #f3f4f6 100%)",
        py: 4,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, sm: 4 },
          maxWidth: 720,
          width: "100%",
          mx: 2,
          textAlign: "left",
          alignSelf: "flex-start",
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2, textTransform: "none" }}
          size="small"
        >
          Back
        </Button>

        <Typography variant="h4" fontWeight={800} gutterBottom sx={{ color: "primary.main" }}>
          Privacy Policy
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Effective: {EFFECTIVE_DATE}
        </Typography>

        <Stack spacing={1}>
          <P>
            iTag Timestamp Portal ("we", "our", or "the Service") is committed to protecting
            your privacy. This policy explains how we collect, use, and safeguard your
            information when you use our web application.
          </P>

          <Section title="1. Information We Collect">
            <P>
              <strong>Account Information:</strong> When you create an account, we collect your
              name and email address. If you sign in with Google, we receive your Google display
              name, email, and profile photo URL.
            </P>
            <P>
              <strong>Session Data:</strong> When you run timing sessions, we store timestamps,
              ZUPT data, lap information, and session metadata that you create within the app.
            </P>
            <P>
              <strong>Plan Data:</strong> Timing plans you create (plan names, ZUPT configurations,
              lap settings) are stored to your account.
            </P>
          </Section>

          <Section title="2. How We Use Your Information">
            <P>
              We use your information solely to provide and improve the Timestamp Portal service.
              Specifically, we use it to: authenticate your identity, store and sync your timing
              sessions and plans across devices, send transactional emails (account verification,
              password resets, welcome messages), and maintain service reliability.
            </P>
          </Section>

          <Section title="3. Data Storage and Security">
            <P>
              Your data is stored securely using Google Firebase (Cloud Firestore) with encryption
              in transit and at rest. Authentication is handled by Firebase Authentication. We do
              not store your password directly -- it is managed by Firebase Auth's secure
              infrastructure.
            </P>
            <P>
              The app supports offline access through a local IndexedDB cache, which stores your
              data on your device. This data syncs with our servers when you reconnect.
            </P>
          </Section>

          <Section title="4. Third-Party Services">
            <P>We use the following third-party services:</P>
            <P>
              <strong>Google Firebase:</strong> Authentication, database, hosting, and cloud
              functions. Subject to Google's privacy policy.
            </P>
            <P>
              <strong>Resend:</strong> Transactional email delivery for account verification,
              password resets, and welcome emails. Your email address is shared with Resend
              for this purpose only.
            </P>
            <P>
              <strong>Google Fonts:</strong> Typography loaded from Google's font servers.
            </P>
            <P>
              <strong>OpenStreetMap:</strong> Map tiles for session map views. No personal
              data is shared with OpenStreetMap.
            </P>
          </Section>

          <Section title="5. Cookies and Local Storage">
            <P>
              We use browser local storage to save your theme preference (light/dark mode) and
              Firebase uses IndexedDB for offline data caching. We do not use tracking cookies
              or third-party advertising cookies.
            </P>
          </Section>

          <Section title="6. Data Retention">
            <P>
              Your data is retained as long as your account is active. You can delete individual
              sessions or plans at any time. If you delete your account, all associated data
              (user profile, sessions, plans) is permanently removed from our servers.
            </P>
          </Section>

          <Section title="7. Your Rights">
            <P>
              You have the right to: access your personal data through the app, update your
              profile information in Settings, export your session data, and delete your account
              and all associated data permanently through the Settings page.
            </P>
          </Section>

          <Section title="8. Children's Privacy">
            <P>
              The Service is not intended for children under 13. We do not knowingly collect
              personal information from children under 13. If we learn that we have collected
              data from a child under 13, we will delete it promptly.
            </P>
          </Section>

          <Section title="9. Changes to This Policy">
            <P>
              We may update this privacy policy from time to time. We will notify you of
              significant changes by posting the new policy on this page with an updated
              effective date.
            </P>
          </Section>

          <Section title="10. Contact Us">
            <P>
              If you have questions about this privacy policy or your data, please contact us
              at support@itagts.com.
            </P>
          </Section>
        </Stack>
      </Paper>
    </Box>
  );
}

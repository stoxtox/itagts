// src/components/TermsOfServicePage.jsx
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

export default function TermsOfServicePage() {
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
          Terms of Service
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Effective: {EFFECTIVE_DATE}
        </Typography>

        <Stack spacing={1}>
          <P>
            Welcome to iTag Timestamp Portal. By accessing or using our service, you agree to
            be bound by these Terms of Service. If you do not agree, please do not use the Service.
          </P>

          <Section title="1. Description of Service">
            <P>
              iTag Timestamp Portal is a web-based timing application designed for sports timing
              operations. The Service allows users to create timing plans, capture timestamps,
              record ZUPT (Zero Velocity Update) data, and manage timing sessions. The Service
              includes a web application with offline support.
            </P>
          </Section>

          <Section title="2. User Accounts">
            <P>
              You must create an account to use the Service. You are responsible for maintaining
              the confidentiality of your account credentials and for all activities under your
              account. You agree to provide accurate information when creating your account and
              to keep it up to date. You must notify us immediately if you suspect unauthorized
              access to your account.
            </P>
          </Section>

          <Section title="3. Acceptable Use">
            <P>
              You agree to use the Service only for its intended purpose of sports timing and
              related activities. You agree not to: attempt to gain unauthorized access to the
              Service or its systems, use the Service for any unlawful purpose, interfere with
              or disrupt the Service or servers, reverse-engineer or attempt to extract source
              code from the Service, or use automated scripts to access the Service without
              permission.
            </P>
          </Section>

          <Section title="4. Your Content">
            <P>
              You retain ownership of all data you create within the Service, including timing
              plans, sessions, and timestamps. By using the Service, you grant us a limited
              license to store, process, and display your content solely for the purpose of
              providing the Service to you. We do not claim ownership of your content and will
              not use it for any purpose other than delivering the Service.
            </P>
          </Section>

          <Section title="5. Service Availability">
            <P>
              We strive to maintain high availability but do not guarantee uninterrupted access.
              The Service may be temporarily unavailable for maintenance, updates, or due to
              circumstances beyond our control. The offline functionality allows you to continue
              capturing data during network outages, with automatic synchronization when
              connectivity is restored.
            </P>
          </Section>

          <Section title="6. Limitation of Liability">
            <P>
              The Service is provided "as is" and "as available" without warranties of any kind,
              either express or implied. We shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages resulting from your use of or inability
              to use the Service. In particular, we are not liable for any loss of timing data
              or inaccuracies in timestamps.
            </P>
          </Section>

          <Section title="7. Account Termination">
            <P>
              You may delete your account at any time through the Settings page. Upon deletion,
              all your data will be permanently removed from our servers. We reserve the right
              to suspend or terminate accounts that violate these terms, with notice where
              practicable.
            </P>
          </Section>

          <Section title="8. Changes to These Terms">
            <P>
              We may modify these Terms of Service at any time. We will notify you of significant
              changes by updating the effective date and, where appropriate, through in-app
              notifications. Continued use of the Service after changes constitutes acceptance
              of the updated terms.
            </P>
          </Section>

          <Section title="9. Governing Law">
            <P>
              These terms shall be governed by and construed in accordance with the laws of the
              United States. Any disputes arising from these terms shall be resolved through
              good-faith negotiation.
            </P>
          </Section>

          <Section title="10. Contact Us">
            <P>
              If you have questions about these terms, please contact us at support@itagts.com.
            </P>
          </Section>
        </Stack>
      </Paper>
    </Box>
  );
}

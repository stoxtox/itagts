// src/components/runner/StatusDialogs.jsx
import React from "react";
import {
  Button, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";

export default function StatusDialogs({ openPanel, onClose, queuedCount, finishedCount }) {
  return (
    <>
      <Dialog open={openPanel === "net"} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>Network status</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            You're offline because the network is unavailable. Actions are queued locally and will upload automatically when you're
            back online.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openPanel === "queued"} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>Queued changes</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            {queuedCount === 0
              ? "No queued changes."
              : `${queuedCount} change${queuedCount > 1 ? "s" : ""} will upload when you're back online.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openPanel === "finished"} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>Finished (pending upload)</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            {finishedCount === 0
              ? "No finished sessions pending."
              : `${finishedCount} finished session${finishedCount > 1 ? "s are" : " is"} waiting to upload.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

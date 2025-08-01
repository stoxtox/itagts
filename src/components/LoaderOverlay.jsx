import React from "react";
import { Backdrop, CircularProgress } from "@mui/material";

/** Full-viewport dim + spinner */
export default function LoaderOverlay({ open }) {
  return (
    <Backdrop
      open={open}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 1, color: "#fff" }}
    >
      <CircularProgress thickness={5} size={72} />
    </Backdrop>
  );
}

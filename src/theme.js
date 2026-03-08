import { createTheme } from "@mui/material/styles";

export const createAppTheme = (mode = "light") =>
  createTheme({
    palette: {
      mode,
      primary:   { main: "#4f46e5" },   // indigo-600
      secondary: { main: "#6366f1" },   // indigo-500
      ...(mode === "dark"
        ? {
            background: {
              default: "#121212",
              paper: "#1e1e2f",
            },
          }
        : {
            background: {
              default: "#f5f5f7",
              paper: "#ffffff",
            },
          }),
    },

    /* ---------- global typography ---------- */
    typography: {
      fontFamily: [
        "Inter",                     // primary
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "Roboto",
        '"Helvetica Neue"',
        "Arial",
        "sans-serif",
      ].join(","),
    },

    /* ---------- default radius for most things ---------- */
    shape: {
      borderRadius: 5,              // e.g. Cards, Dialogs
    },

    /* ---------- component-level overrides ---------- */
    components: {
      /*  rounded TextField / Select / Autocomplete  */
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },

      /*  pill-style buttons  */
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            textTransform: "none",
            fontWeight: 600,
          },
        },
        defaultProps: {
          disableElevation: true,
        },
      },

      /*  smoother chips  */
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            fontWeight: 500,
          },
        },
      },

      /*  larger rounding for Papers you mark as "rounded"  */
      MuiPaper: {
        styleOverrides: {
          rounded: { borderRadius: 20 },
        },
      },
    },
  });

// Backward-compatible default export
const theme = createAppTheme("light");
export default theme;

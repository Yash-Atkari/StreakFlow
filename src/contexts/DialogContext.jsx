import { createContext, useContext, useState } from "react";
import "../styles/dialog.css";

const DialogContext = createContext({
  alert: async () => {},
  confirm: async () => false,
});

export function DialogProvider({ children }) {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    type: "alert", // "alert" | "confirm"
    title: "",
    message: "",
    resolve: null,
  });

  const alert = (message, title = "Alert") => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        type: "alert",
        title,
        message,
        resolve,
      });
    });
  };

  const confirm = (message, title = "Confirm") => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        type: "confirm",
        title,
        message,
        resolve,
      });
    });
  };

  const handleClose = (value) => {
    if (dialogState.resolve) {
      dialogState.resolve(value);
    }
    setDialogState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}
      {dialogState.isOpen && (
        <div className="custom-dialog-overlay" onClick={() => handleClose(false)}>
          <div className="custom-dialog-card" onClick={(e) => e.stopPropagation()}>
            {dialogState.title && (
              <h5 className="custom-dialog-title">{dialogState.title}</h5>
            )}
            <div className="custom-dialog-message">{dialogState.message}</div>
            <div className="custom-dialog-actions">
              {dialogState.type === "confirm" && (
                <button
                  className="custom-dialog-btn cancel-btn"
                  onClick={() => handleClose(false)}
                >
                  Cancel
                </button>
              )}
              <button
                className="custom-dialog-btn confirm-btn"
                onClick={() => handleClose(true)}
              >
                {dialogState.type === "confirm" ? "Confirm" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  return useContext(DialogContext);
}

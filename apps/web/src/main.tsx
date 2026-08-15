import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "./context/AuthContext";
import { App } from "./App";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
      <Toaster
        position="bottom-right"
        theme="system"
        toastOptions={{
          classNames: {
            toast: "!bg-card !text-card-foreground !border-border",
            title: "!text-card-foreground",
            description: "!text-muted-foreground",
            success: "!border-l-4 !border-l-success",
            error: "!border-l-4 !border-l-destructive",
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
);

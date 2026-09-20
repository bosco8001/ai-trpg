import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./style.css";

const root = document.getElementById("root");
if (!root) throw new Error("找不到網頁掛載位置。");
createRoot(root).render(<StrictMode><App /></StrictMode>);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./style.css";
import "./class-catalog.css";
import "./starter-kit-catalog.css";
import "./character-derivation.css";
import "./character-creation.css";

const root = document.getElementById("root");
if (!root) throw new Error("找不到網頁掛載位置。");
createRoot(root).render(<StrictMode><App /></StrictMode>);

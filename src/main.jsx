import React from "react";
import { createRoot } from "react-dom/client";
import OutcomerGen from "./OutcomerGen";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<OutcomerGen />);
}

export default OutcomerGen;

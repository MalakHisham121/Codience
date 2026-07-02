import { BrowserRouter } from "react-router-dom";
import "./App.css";
import AppRoutes from "./routes/AppRoutes";
import GlobalJiraListener from "./components/GlobalJiraListener";

function App() {
  return (
    <BrowserRouter>
      <GlobalJiraListener />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;

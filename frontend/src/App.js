import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { AuthProvider } from "./context/AuthContext";
// Components
import NavBar from "./components/Navbar";
import Login from "./components/Login";
import Register from "./components/Register";
import ScrapingDashboard from "./components/ScrapingDashboard";
import AdminModelTraining from "./components/AdminModelTraining";
import PricePredictor from "./components/PricePredictor";
import AdminHistory from "./components/AdminHistory";
import LandingPage from "./components/LandingPage";

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <NavBar />
          <div className="container mt-4">
            <Routes>
              <Route path="/" element={<LandingPage />}/>
              {/* <Route path="/" element={<PricePredictor />} /> */}
              <Route path="/predict" element={<PricePredictor />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/admin" element={<AdminModelTraining />} />
              <Route path="/scraping" element={<ScrapingDashboard />} />
              <Route path="/admin/history" element={<AdminHistory />} />
            </Routes>
          </div>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

export default App;
import React from "react";
import { Link } from "react-router-dom";
import "./LandingPage.css";

const LandingPage = () => {
  const guideURL =
    "https://drive.google.com/file/d/1IdgTGM_qoY0B4So-vA8zfacNZ4oOCLac/view?usp=sharing";

  // Fungsi untuk membuka panduan di Google Drive
  const openGuide = () => {
    window.open(guideURL, "_blank");
  };
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1>Commoprize</h1>
          <h2>Prediksi Harga Komoditas Pangan</h2>
          <p>Khusus untuk Harga Rata-Rata Wilayah Provinsi Jawa Timur</p>
          <div className="hero-buttons">
            <Link to="/predict" className="btn btn-light btn-lg">
              Coba Prediksi Sekarang
            </Link>
            <Link to="/login" className="btn btn-outline-light btn-lg">
              Login
            </Link>
          </div>
        </div>
        <div className="hero-image">
          <img src="/analysis.png" alt="Ilustrasi prediksi harga" />
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2>Fitur Utama</h2>
        <div className="features-container">
          <div className="feature-card">
            <div className="feature-icon">
              <i className="fas fa-chart-line"></i>
            </div>
            <h3>Prediksi Harga</h3>
            <p>
              Dapatkan prediksi harga untuk 11 komoditas pangan strategis
              menggunakan model Long Short Term Memory
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <i className="fas fa-database"></i>
            </div>
            <h3>Scraping Data</h3>
            <p>
              Data diambil secara otomatis dari Panel Harga Pangan Nasional
              untuk hasil prediksi akurat
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <i className="fas fa-brain"></i>
            </div>
            <h3>Model AI Canggih</h3>
            <p>
              Menggunakan teknologi Long Short-Term Memory (LSTM) untuk analisis
              tren harga
            </p>
          </div>
        </div>
      </section>

      {/* Commodities Section */}
      <section className="commodities-section">
        <h2>Komoditas yang Tersedia</h2>
        <div className="commodities-container">
          {[
            { name: "Beras", icon: "🌾" },
            { name: "Gula", icon: "🧂" },
            // { name: 'Minyak Goreng', icon: '🫙' },
            { name: "Telur", icon: "🥚" },
            { name: "Daging Ayam", icon: "🍗" },
            { name: "Daging Sapi", icon: "🥩" },
            { name: "Bawang Merah", icon: "🧅" },
            { name: "Bawang Putih", icon: "🧄" },
            { name: "Cabai Merah", icon: "🌶️" },
            { name: "Cabai Rawit", icon: "🌶️" },
            { name: "Kedelai", icon: "🫘" },
          ].map((item, index) => (
            <div className="commodity-item" key={index}>
              <span className="commodity-icon">{item.icon}</span>
              <span className="commodity-name">{item.name}</span>
            </div>
          ))}
        </div>
        <div className="commodity-action">
          <Link to="/predict" className="btn btn-primary">
            Mulai Prediksi
          </Link>
        </div>
      </section>

      <section className="how-it-works-section">
        <h2>Bagaimana Sistem Bekerja</h2>
        <div className="steps-container">
          <div className="step-item">
            <div className="step-number">1</div>
            <h3>Pengumpulan Data</h3>
            <p>
              Sistem secara otomatis mengumpulkan data harga dari Panel Harga
              Pangan Nasional
            </p>
          </div>
          <div className="step-item">
            <div className="step-number">2</div>
            <h3>Preprocessing</h3>
            <p>
              Data dibersihkan dan diformat untuk dianalisis oleh model LSTM
            </p>
          </div>
          <div className="step-item">
            <div className="step-number">3</div>
            <h3>Pelatihan Model</h3>
            <p>
              Model LSTM dilatih dengan data historis untuk mengenali pola harga
            </p>
          </div>
          <div className="step-item">
            <div className="step-number">4</div>
            <h3>Prediksi</h3>
            <p>
              Sistem menghasilkan prediksi harga untuk periode yang ditentukan
            </p>
          </div>
        </div>
      </section>
      {/* Guide Section - Section baru untuk panduan */}
      <section
        className="guide-section"
        style={{
          padding: "50px 0",
          backgroundColor: "#f8f9fa",
          textAlign: "center",
          borderRadius: "10px",
          margin: "30px 0",
        }}
      >
        <div>
          <div style={{ marginBottom: "20px", fontSize: "48px" }}>
            {/* Emoji sebagai pengganti ikon */}❓
          </div>
          <h2
            style={{ fontSize: "36px", color: "#2c3e50", marginBottom: "20px" }}
          >
            Panduan Penggunaan Aplikasi
          </h2>
          <p
            style={{
              fontSize: "18px",
              color: "#7f8c8d",
              maxWidth: "700px",
              margin: "0 auto 30px",
            }}
          >
            Bingung cara menggunakan aplikasi Commoprize? Jangan khawatir! Kami
            telah menyiapkan panduan lengkap untuk membantu Anda memaksimalkan
            fitur prediksi harga komoditas pangan.
          </p>
          <button
            onClick={openGuide}
            className="btn btn-primary btn-lg"
            style={{
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <span style={{ marginRight: "10px", fontSize: "20px" }}>📄</span>
            <span>Lihat Panduan Website</span>
          </button>
        </div>
      </section>

      {/* Call to Action */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>COMMOPRIZE</h2>
          <h2>Commodity Price Predictor</h2>
          <p>
            Dapatkan prediksi harga komoditas pangan yang akurat untuk
            perencanaan yang lebih baik
          </p>
          <p>😚😚😚</p>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;

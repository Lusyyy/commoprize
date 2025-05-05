import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './ScrapingDashboard.css';

const API_BASE_URL = 'http://localhost:5000/api';

const ScrapingDashboard = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isScrapingRunning, setIsScrapingRunning] = useState(false);
  const [scrapingResult, setScrapingResult] = useState(null);
  const [dataStatus, setDataStatus] = useState([]);
  const [mappingStatus, setMappingStatus] = useState(null);
  const [daysBack, setDaysBack] = useState(70);
  const [komoditasList, setKomoditasList] = useState([]);
  const [error, setError] = useState(null);

  // Fungsi untuk mengambil data dengan menggunakan useCallback agar tidak dibuat ulang saat render
  const fetchDataStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/data-status?days=${daysBack}`);
      setDataStatus(response.data.data);
      setError(null);
    } catch (err) {
      setError(`Error fetching data status: ${err.message}`);
      console.error('Error fetching data status:', err);
    } finally {
      setIsLoading(false);
    }
  }, [daysBack]);

  const fetchMappingStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/check-mapping`);
      setMappingStatus(response.data);
    } catch (err) {
      console.error('Error fetching mapping status:', err);
    }
  }, []);

  const fetchKomoditas = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/komoditas`);
      setKomoditasList(response.data.komoditas);
    } catch (err) {
      console.error('Error fetching komoditas list:', err);
    }
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchDataStatus();
    fetchMappingStatus();
    fetchKomoditas();
  }, [fetchDataStatus, fetchMappingStatus, fetchKomoditas]);

  // Run scraping
  const runScraping = async () => {
    try {
      setError(null);
      setIsScrapingRunning(true);
      setScrapingResult(null);

      const response = await axios.post(`${API_BASE_URL}/scrape`, {
        days_back: daysBack
      });

      setScrapingResult(response.data);
      
      // Refresh data status after scraping
      await fetchDataStatus();
    } catch (err) {
      setError(`Error running scraping: ${err.message}`);
      console.error('Error running scraping:', err);
    } finally {
      setIsScrapingRunning(false);
    }
  };

  // Handle scraping button click
  const handleScrapingClick = () => {
    if (mappingStatus && mappingStatus.status !== 'ok') {
      if (!window.confirm('Pemetaan komoditas memiliki masalah. Tetap lanjutkan scraping?')) {
        return;
      }
    }
    runScraping();
  };

  // Get status color based on completion
  const getStatusColor = (count, total) => {
    if (count === 0) return 'status-empty';
    if (count < total) return 'status-partial';
    return 'status-complete';
  };

  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Handle days input change
  const handleDaysChange = (e) => {
    const newDays = parseInt(e.target.value);
    setDaysBack(newDays);
  };

  // Update data status when daysBack changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDataStatus();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [daysBack, fetchDataStatus]);

  return (
    <div className="scraping-dashboard">
      <h1>Scraping Harga Komoditas</h1>
      
      {/* Error alert */}
      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
          <button className="close-btn" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Info dari mana data diambil */}
      <div className="info-panel">
        <h3>Informasi Scraping</h3>
        <p>Data diambil dari API Badan Pangan Nasional Indonesia untuk wilayah Jawa Timur sebagai bahan input 60 data prediksi.</p>
        <p>Semua data yang diambil adalah harga tingkat konsumen (rata-rata).</p>
      </div>

      {/* Mapping status */}
      {/* {mappingStatus && (
        <div className={`mapping-status ${mappingStatus.status === 'ok' ? 'mapping-ok' : 'mapping-error'}`}>
          <h3>Status Pemetaan Komoditas:</h3>
          {mappingStatus.status === 'ok' ? (
            <p>✅ Pemetaan komoditas valid</p>
          ) : (
            <div>
              <p>❌ Terdapat masalah pada pemetaan komoditas:</p>
              {mappingStatus.missing_komoditas && mappingStatus.missing_komoditas.length > 0 && (
                <div>
                  <strong>Komoditas tidak terpetakan:</strong>
                  <ul>
                    {mappingStatus.missing_komoditas.map((item, index) => (
                      <li key={`missing-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {mappingStatus.invalid_mappings && mappingStatus.invalid_mappings.length > 0 && (
                <div>
                  <strong>Pemetaan tidak valid:</strong>
                  <ul>
                    {mappingStatus.invalid_mappings.map((item, index) => (
                      <li key={`invalid-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )} */}

      {/* Scraping control */}
      <div className="scraping-control">
        <h3>Jalankan Scraping</h3>
        <div className="control-panel">
          <div className="input-group">
            <label htmlFor="days-back">Jumlah hari ke belakang:</label>
            <input
              type="number"
              id="days-back"
              min="1"
              max="365"
              value={daysBack}
              onChange={handleDaysChange}
              disabled={isScrapingRunning}
            />
          </div>
          <button
            className="btn-scrape"
            onClick={handleScrapingClick}
            disabled={isScrapingRunning}
          >
            {isScrapingRunning ? (
              <>
                <span className="spinner"></span> Sedang Scraping...
              </>
            ) : (
              'Mulai Scraping'
            )}
          </button>
        </div>
      </div>

      {/* Scraping result */}
      {scrapingResult && (
        <div className={`scraping-result ${scrapingResult.status === 'success' ? 'result-success' : 'result-error'}`}>
          <h3>Hasil Scraping:</h3>
          {scrapingResult.status === 'success' ? (
            <div>
              <p>✅ Berhasil menyimpan {scrapingResult.data_saved} data baru</p>
              {scrapingResult.failed_dates && scrapingResult.failed_dates.length > 0 && (
                <div>
                  <p>⚠️ Gagal mengambil data untuk tanggal:</p>
                  <ul className="failed-dates-list">
                    {scrapingResult.failed_dates.map((date, index) => (
                      <li key={`failed-${index}`}>{formatDate(date)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p>❌ Error: {scrapingResult.message}</p>
          )}
        </div>
      )}

      {/* Data completeness section */}
      <div className="data-status">
        <h3>Status Kelengkapan Data ({komoditasList.length} komoditas)</h3>
        
        {isLoading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading data status...</p>
          </div>
        ) : (
          <div className="status-container">
            <div className="status-grid">
              {dataStatus.map((item) => (
                <div
                  key={item.tanggal}
                  className={`status-item ${getStatusColor(item.jumlah_data, komoditasList.length)}`}
                  title={`${formatDate(item.tanggal)}: ${item.jumlah_data || 0} dari ${komoditasList.length} komoditas`}
                >
                  <div className="status-date">{new Date(item.tanggal).getDate()}</div>
                  <div className="status-count">{item.jumlah_data || 0}/{komoditasList.length}</div>
                </div>
              ))}
            </div>
            
            <div className="status-legend">
              <div className="legend-item">
                <div className="legend-color status-complete"></div>
                <div>Lengkap</div>
              </div>
              <div className="legend-item">
                <div className="legend-color status-partial"></div>
                <div>Sebagian</div>
              </div>
              <div className="legend-item">
                <div className="legend-color status-empty"></div>
                <div>Kosong</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScrapingDashboard;
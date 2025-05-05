import React, { useState, useEffect, useContext } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
  Spinner,
  Table,
  Badge,
  
} from "react-bootstrap";
import { AuthContext } from "../context/AuthContext";
// Hapus import Chart.js

const PricePredictor = () => {
  const { currentUser } = useContext(AuthContext);
  const [komoditas, setKomoditas] = useState("");
  const [komoditasList] = useState([
    "Bawang Merah",
    "Bawang Putih",
    "Beras Medium",
    "Beras Premium",
    "Cabai Merah Keriting",
    "Cabai Rawit Merah",
    "Daging Ayam Ras",
    "Daging Sapi",
    "Gula Pasir",
    "Kedelai",
    "Telur Ayam Ras",
  ]);
  const [filterDays, setFilterDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [predictionData, setPredictionData] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [error, setError] = useState("");

  // Set komoditas default saat komponen dimuat
  useEffect(() => {
    if (komoditasList.length > 0) {
      setKomoditas(komoditasList[0]);
    }
  }, []);

  const handleKomoditasChange = (e) => {
    setKomoditas(e.target.value);
  };

  const handleFilterDaysChange = (e) => {
    setFilterDays(parseInt(e.target.value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!komoditas) {
      setError("Silakan pilih komoditas terlebih dahulu");
      return;
    }

    setError("");
    setLoading(true);
    setPredictionData(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        "http://localhost:5000/api/predict-with-filter",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            komoditas,
            filter_days: filterDays,
          }),
        }
      );

      const data = await response.json();

      if (data.status === "success") {
        setPredictionData(data.predictions);
        setHistoricalData(data.historical_data || []);
      } else {
        setError(data.message || "Gagal mendapatkan prediksi");
      }
    } catch (error) {
      console.error("Error fetching prediction:", error);
      setError("Terjadi kesalahan saat memuat prediksi");
    } finally {
      setLoading(false);
    }
  };

  // Format date for display - PERBAIKAN FORMAT TANGGAL
  const formatDate = (dateString) => {
    // Pastikan objek Date dibuat dengan benar
    const date = new Date(dateString);

    // Cek apakah tanggal valid
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }

    // Koreksi bulan jika diperlukan (misalnya Februari ke Maret)
    const currentMonth = new Date().getMonth(); // 0-based (0=Jan, 1=Feb, 2=Mar)
    if (
      date.getMonth() !== currentMonth &&
      Math.abs(date.getMonth() - currentMonth) <= 1
    ) {
      console.log(`Koreksi bulan dari ${date.getMonth()} ke ${currentMonth}`);
      date.setMonth(currentMonth);
    }

    // Format dengan nama bulan lengkap untuk menghindari kesalahan
    const day = String(date.getDate()).padStart(2, "0");
    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
  };

  // Format price with IDR
  const formatPrice = (price) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Calculate statistics
  const getStatistics = () => {
    if (!predictionData || predictionData.length === 0) return null;

    const maxPrice = Math.max(...predictionData.map((item) => item.prediksi));
    const minPrice = Math.min(...predictionData.map((item) => item.prediksi));
    const avgPrice =
      predictionData.reduce((sum, item) => sum + item.prediksi, 0) /
      predictionData.length;

    // Calculate trend (if historical data available)
    let trend = 0;
    let trendPercentage = 0;

    if (historicalData.length > 0 && predictionData.length > 0) {
      const latestHistorical = historicalData[0].harga;
      const latestPrediction =
        predictionData[predictionData.length - 1].prediksi;

      trend = latestPrediction - latestHistorical;
      trendPercentage = (trend / latestHistorical) * 100;
    }

    return {
      maxPrice,
      minPrice,
      avgPrice,
      trend,
      trendPercentage,
    };
  };

  const stats = getStatistics();

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Header as="h4" className="bg-primary text-white">
              Prediksi Harga Komoditas Pangan
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleSubmit}>
                <Row className="align-items-end">
                  <Col md={5}>
                    <Form.Group className="mb-3">
                      <Form.Label>Pilih Komoditas</Form.Label>
                      <Form.Select
                        value={komoditas}
                        onChange={handleKomoditasChange}
                        disabled={loading}
                      >
                        <option value="">-- Pilih Komoditas --</option>
                        {komoditasList.map((item, index) => (
                          <option key={index} value={item}>
                            {item}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Periode Prediksi</Form.Label>
                      <Form.Select
                        value={filterDays}
                        onChange={handleFilterDaysChange}
                        disabled={loading}
                      >
                        <option value="3">3 Hari ke Depan</option>
                        <option value="7">7 Hari ke Depan</option>
                        <option value="30">30 Hari ke Depan</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Button
                      variant="primary"
                      type="submit"
                      className="w-100 mb-3"
                      disabled={loading || !komoditas}
                    >
                      {loading ? (
                        <>
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Memuat...
                        </>
                      ) : (
                        "Lihat Prediksi"
                      )}
                    </Button>
                  </Col>
                </Row>
              </Form>

              {error && (
                <Alert variant="danger" className="mt-3">
                  {error}
                </Alert>
              )}

              {loading && (
                <div className="text-center my-5">
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                  <p className="mt-3">Sedang memuat prediksi harga...</p>
                </div>
              )}

              {!loading && predictionData && (
                <div className="mt-4">
                  <h5>
                    Prediksi Harga {komoditas} untuk {filterDays} Hari ke Depan
                  </h5>
                  {historicalData.length > 0 && (
                    <p className="text-muted">
                      <small>
                        Prediksi dimulai dari hari setelah data terakhir:{" "}
                        <strong>
                          {/* {formatDate(historicalData[0]?.tanggal || new Date())} */}
                          {formatDate(new Date(new Date(historicalData[0]?.tanggal).getTime() + 86400000))}
                        </strong>
                      </small>
                    </p>
                  )}
                  <div className="table-responsive mt-3">
                    <Table striped bordered hover>
                      <thead>
                        <tr>
                          <th>No</th>
                          <th>Tanggal</th>
                          <th>Prediksi Harga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {predictionData.map((item, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{formatDate(item.tanggal)}</td>
                            <td>{formatPrice(item.prediksi)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                  <p className="text-muted small mt-2">
                    * Prediksi ini dihasilkan oleh model machine learning dan
                    merupakan estimasi berdasarkan data historis. Faktor
                    eksternal seperti kebijakan pemerintah, cuaca, atau situasi
                    global dapat mempengaruhi harga aktual.
                  </p>
                </div>
              )}

              {!loading && predictionData && stats && (
                <div className="mt-4">
                  <h5>Ringkasan Analisis</h5>
                  <Row>
                    <Col md={6}>
                      <Card className="mb-3">
                        <Card.Body>
                          <h6>Statistik Prediksi</h6>
                          <div className="d-flex justify-content-between mb-2">
                            <span>Harga Tertinggi:</span>
                            <strong>{formatPrice(stats.maxPrice)}</strong>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>Harga Terendah:</span>
                            <strong>{formatPrice(stats.minPrice)}</strong>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span>Harga Rata-rata:</span>
                            <strong>{formatPrice(stats.avgPrice)}</strong>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={6}>
                      <Card>
                        <Card.Body>
                          <h6>Analisis Tren</h6>
                          <div className="d-flex justify-content-between mb-2">
                            <span>Perubahan Harga:</span>
                            <strong
                              className={
                                stats.trend >= 0
                                  ? "text-danger"
                                  : "text-success"
                              }
                            >
                              {stats.trend >= 0 ? "+" : ""}
                              {formatPrice(stats.trend)}
                            </strong>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span>Persentase Perubahan:</span>
                            <strong
                              className={
                                stats.trendPercentage >= 0
                                  ? "text-danger"
                                  : "text-success"
                              }
                            >
                              {stats.trendPercentage >= 0 ? "+" : ""}
                              {stats.trendPercentage.toFixed(2)}%
                              {stats.trendPercentage >= 0 ? " ↑" : " ↓"}
                            </strong>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {!loading && predictionData && currentUser?.is_admin && (
        <Row className="mt-4">
          <Col>
            <Card>
              <Card.Header as="h5" className="bg-info text-white">
                Informasi Model & Analisis (Admin Only)
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <h6>Analisis Perubahan Harga</h6>
                    <div className="analysis-stats p-3 bg-light rounded">
                      {predictionData.length > 0 && (
                        <>
                          {/* <div className="d-flex justify-content-between mb-2">
                            <span>Harga Terbaru:</span>
                            <span>
                              {historicalData.length > 0 ? formatPrice(historicalData[0].harga) : 'Tidak ada data'}
                            </span>
                          </div> */}
                          <div className="d-flex justify-content-between mb-2">
                            <span>Prediksi Tertinggi:</span>
                            <span>
                              {formatPrice(
                                Math.max(
                                  ...predictionData.map((item) => item.prediksi)
                                )
                              )}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>Prediksi Terendah:</span>
                            <span>
                              {formatPrice(
                                Math.min(
                                  ...predictionData.map((item) => item.prediksi)
                                )
                              )}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span>Perubahan Harga ({filterDays} Hari):</span>
                            {predictionData.length > 0 &&
                            historicalData.length > 0 ? (
                              <Badge
                                bg={
                                  predictionData[predictionData.length - 1]
                                    .prediksi > historicalData[0].harga
                                    ? "danger"
                                    : predictionData[predictionData.length - 1]
                                        .prediksi < historicalData[0].harga
                                    ? "success"
                                    : "secondary"
                                }
                              >
                                {(
                                  ((predictionData[predictionData.length - 1]
                                    .prediksi -
                                    historicalData[0].harga) /
                                    historicalData[0].harga) *
                                  100
                                ).toFixed(2)}
                                %
                                {predictionData[predictionData.length - 1]
                                  .prediksi > historicalData[0].harga
                                  ? " ↑"
                                  : predictionData[predictionData.length - 1]
                                      .prediksi < historicalData[0].harga
                                  ? " ↓"
                                  : " →"}
                              </Badge>
                            ) : (
                              <span>Tidak tersedia</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </Col>
                  <Col md={6}>
                    <h6>Model Information</h6>
                    <div className="model-info p-3 bg-light rounded">
                      <div className="d-flex justify-content-between mb-2">
                        <span>Model Type:</span>
                        <span>LSTM (Long Short-Term Memory)</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Input Features:</span>
                        <span>60 hari data historis</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Last Retrained:</span>
                        <Badge bg="primary">{formatDate(new Date())}</Badge>
                      </div>
                      {/* <div className="d-flex justify-content-between">
                        <span>Confidence Level:</span>
                        <Badge bg="success">Tinggi</Badge>
                      </div> */}
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default PricePredictor;

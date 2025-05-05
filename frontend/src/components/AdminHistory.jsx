import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Table, Badge, Modal, Image } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './AdminHistory.css';

const AdminHistory = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // State untuk menyimpan data
  const [trainingHistory, setTrainingHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // State untuk modal visualisasi
  const [showVisualization, setShowVisualization] = useState(false);
  const [selectedKomoditas, setSelectedKomoditas] = useState('');
  const [visualizationImage, setVisualizationImage] = useState('');
  const [loadingVisualization, setLoadingVisualization] = useState(false);
  const [visualizationPredictionImage, setVisualizationPredictionImage] = useState('');
  const [plotViewMode, setPlotViewMode] = useState('training'); 
  
  // Check if user is admin
  useEffect(() => {
    if (currentUser && !currentUser.is_admin) {
      navigate('/');
    } else if (!currentUser) {
      navigate('/login');
    } else {
      fetchTrainingHistory();
    }
  }, [currentUser, navigate]);
  
  // Fetch training history
  const fetchTrainingHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:5000/api/admin/training-history', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        console.log('Training history data:', data.history);
        setTrainingHistory(data.history || []);
      } else {
        setError(data.message || 'Gagal mengambil riwayat training');
      }
    } catch (error) {
      console.error('Error fetching training history:', error);
      setError(`Gagal mengambil data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    
    const options = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return new Date(dateString).toLocaleDateString('id-ID', options);
  };
  
  // Fetch visualization image
  // Fetch visualization image
  const fetchVisualization = async (komoditas) => {
    setLoadingVisualization(true);
    try {
      const token = localStorage.getItem('token');
      const formattedKomoditas = komoditas.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
      
      // Ambil kedua jenis visualisasi sekaligus
      
      // 1. Visualisasi training history
      const timestamp = new Date().getTime();
      const visualizationTrainingPath = `http://localhost:5000/api/admin/plot-image/${formattedKomoditas}?type=training_history&t=${timestamp}`;
      
      // 2. Visualisasi prediksi
      const visualizationPredictionPath = `http://localhost:5000/api/admin/prediction-plot/${formattedKomoditas}?t=${timestamp}`;
      
      console.log("Fetching visualizations from:");
      console.log("- Training history:", visualizationTrainingPath);
      console.log("- Prediction:", visualizationPredictionPath);
      
      // Set visualisasi
      setVisualizationImage(visualizationTrainingPath);
      setVisualizationPredictionImage(visualizationPredictionPath);
      
      setSelectedKomoditas(komoditas);
      setShowVisualization(true);
      setPlotViewMode('training'); // Default ke view training history
    } catch (error) {
      console.error(`Error fetching visualization for ${komoditas}:`, error);
      setError(`Gagal mengambil visualisasi untuk ${komoditas}: ${error.message}`);
    } finally {
      setLoadingVisualization(false);
    }
  };
  
  // Refresh data
  const handleRefresh = () => {
    fetchTrainingHistory();
  };
  
  return (
    <Container fluid className="py-4">
      {error && (
        <Row className="mb-4">
          <Col>
            <Alert variant="danger" dismissible onClose={() => setError('')}>
              {error}
            </Alert>
          </Col>
        </Row>
      )}
      
      <Row>
        <Col>
          <Card className="shadow-sm">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Riwayat Pelatihan Model</h5>
              <Button variant="outline-primary" size="sm" onClick={handleRefresh} disabled={loading}>
                <i className="fa fa-refresh me-2"></i>
                Refresh Data
              </Button>
            </Card.Header>
            
            <Card.Body>
              <p className="text-muted">
                Model harus dilatih ulang secara berkala untuk menjaga akurasi prediksi.
                Klik "Lihat Grafik" untuk melihat visualisasi hasil training.
              </p>
            </Card.Body>
            
            {loading ? (
              <Card.Body className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3">Memuat data...</p>
              </Card.Body>
            ) : (
              <Card.Body>
                <div className="table-responsive">
                  {trainingHistory.length > 0 ? (
                    <Table striped hover responsive>
                      <thead>
                        <tr>
                          <th>No</th>
                          <th>Komoditas</th>
                          <th>Terakhir Dilatih</th>
                          <th>Jadwal Training Berikutnya</th>
                          <th>Sisa Hari</th>
                          <th>Status</th>
                        
                          <th>Visualisasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainingHistory.map((item, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{item.komoditas}</td>
                            <td>{formatDate(item.training_date)}</td>
                            <td>{formatDate(item.next_training_date)}</td>
                            <td>
                              {item.days_until_next_training <= 0 ? (
                                <Badge bg="danger">Perlu dilatih ulang sekarang</Badge>
                              ) : item.days_until_next_training <= 7 ? (
                                <Badge bg="warning">{item.days_until_next_training} hari lagi</Badge>
                              ) : (
                                <Badge bg="success">{item.days_until_next_training} hari lagi</Badge>
                              )}
                            </td>
                            <td>
                              <Badge bg={item.model_exists ? "success" : "danger"}>
                                {item.model_exists ? 'Model Aktif' : 'Tidak Ada Model'}
                              </Badge>
                            </td>
                            
                            <td>
                              {item.model_exists ? (
                                <Button 
                                  variant="outline-info" 
                                  size="sm"
                                  onClick={() => fetchVisualization(item.komoditas)}
                                  disabled={loadingVisualization}
                                >
                                  <i className="fa fa-chart-line me-1"></i>
                                  Lihat Grafik
                                </Button>
                              ) : (
                                <Button variant="outline-secondary" size="sm" disabled>
                                  <i className="fa fa-chart-line me-1"></i>
                                  Tidak Ada Grafik
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <Alert variant="info">Tidak ada data riwayat training</Alert>
                  )}
                </div>
              </Card.Body>
            )}
          </Card>
        </Col>
      </Row>
      
      <Modal 
        show={showVisualization} 
        onHide={() => setShowVisualization(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Visualisasi - {selectedKomoditas}
            <div className="btn-group btn-group-sm ms-3">
              <Button 
                variant={plotViewMode === 'training' ? 'primary' : 'outline-primary'}
                onClick={() => setPlotViewMode('training')}
              >
                Training History
              </Button>
              <Button 
                variant={plotViewMode === 'prediction' ? 'primary' : 'outline-primary'}
                onClick={() => setPlotViewMode('prediction')}
              >
                Prediksi
              </Button>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {loadingVisualization ? (
            <div className="text-center p-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3">Memuat visualisasi...</p>
            </div>
          ) : (
            <div className="text-center">
              {plotViewMode === 'training' ? (
                <Image 
                  src={visualizationImage} 
                  alt={`Visualisasi Training ${selectedKomoditas}`} 
                  fluid 
                  className="w-100"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/800x400?text=Visualisasi+Training+Tidak+Tersedia';
                    setError(`Gagal memuat gambar visualisasi training untuk ${selectedKomoditas}`);
                  }}
                />
              ) : (
                <Image 
                  src={visualizationPredictionImage} 
                  alt={`Visualisasi Prediksi ${selectedKomoditas}`} 
                  fluid 
                  className="w-100"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/800x400?text=Visualisasi+Prediksi+Tidak+Tersedia';
                    setError(`Gagal memuat gambar prediksi untuk ${selectedKomoditas}`);
                  }}
                />
              )}
              <p className="text-muted small mt-2">
                Terakhir diupdate: {new Date().toLocaleString()}
              </p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowVisualization(false)}>
            Tutup
          </Button>
          <Button 
            variant="primary" 
            onClick={() => fetchVisualization(selectedKomoditas)}
            disabled={loadingVisualization}
          >
            <i className="fa fa-refresh me-1"></i> Refresh
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AdminHistory;
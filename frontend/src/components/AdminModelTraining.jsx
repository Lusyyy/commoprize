import React, { useState, useEffect, useContext, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, ProgressBar, ListGroup, Badge, Table, Modal, Image, Tabs, Tab, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Line } from 'react-chartjs-2';
import './AdminModelTraining.css';

const AdminModelTraining = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // List komoditas yang tersedia
  const commodities = [
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
    "Telur Ayam Ras"
  ];
  
  // State untuk tracking dataset
  const [uploadedDatasets, setUploadedDatasets] = useState({});
  const [allDatasetsUploaded, setAllDatasetsUploaded] = useState(false);
  
  // State untuk upload
  const [file, setFile] = useState(null);
  const [komoditas, setKomoditas] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  
  // State untuk replace file
  const [replaceMode, setReplaceMode] = useState(false);
  const [komoditasToReplace, setKomoditasToReplace] = useState('');
  
  // State untuk preprocessing
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [preprocessingProgress, setPreprocessingProgress] = useState(0);
  const [preprocessingResults, setPreprocessingResults] = useState([]);
  const [preprocessingDone, setPreprocessingDone] = useState(false);
  
  // State untuk training
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [selectedKomoditasForTraining, setSelectedKomoditasForTraining] = useState('');
  
  // State untuk pesan
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // State untuk konfirmasi hapus
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [komoditasToDelete, setKomoditasToDelete] = useState('');
  
  // State untuk visualisasi
  const [visualizations, setVisualizations] = useState({});
  
  // State untuk modal preview data
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState(null);
  
  // State untuk prediksi 30 hari ke depan
  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [selectedKomoditasPrediction, setSelectedKomoditasPrediction] = useState('');
  const [predictionResults, setPredictionResults] = useState([]);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  
  // Ref untuk interval polling
  const statusIntervalRef = useRef(null);
  // State untuk nama file yang diupload
  const [uploadedFileInfo, setUploadedFileInfo] = useState(null);
  
  // Cek dataset sudah diupload semua
  useEffect(() => {
    // Hitung berapa dataset yang sudah diupload
    const uploadedCount = Object.values(uploadedDatasets).filter(status => status?.uploaded).length;
    
    // Update state allDatasetsUploaded
    setAllDatasetsUploaded(uploadedCount === commodities.length);
    
  }, [uploadedDatasets, commodities.length]);
  
  useEffect(() => {
    // Pastikan pengguna adalah admin
    if (currentUser && !currentUser.is_admin) {
      navigate('/');
    } else if (!currentUser) {
      navigate('/login');
    }
    
    // Cek dataset yang sudah ada di server
    checkExistingDatasets();
    
    // Fetch training status dan visualisasi
    fetchTrainingStatus();
    fetchAllVisualizations(); // Tambahkan ini untuk memuat semua visualisasi
    
    // Clean up interval saat unmount
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [currentUser, navigate]);
  
  // Fungsi untuk mengecek dataset yang sudah ada di server
  const checkExistingDatasets = async () => {
    try {
      // Inisialisasi state datasets
      const initialDatasets = {};
      commodities.forEach(komoditas => {
        initialDatasets[komoditas] = {
          uploaded: false,
          timestamp: null,
          rowCount: 0
        };
      });
      
      setUploadedDatasets(initialDatasets);
      
      // Panggil API untuk mendapatkan status dataset
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/admin/datasets', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success' && data.datasets) {
        // Update state dengan dataset yang sudah ada
        const updatedDatasets = {...initialDatasets};
        
        data.datasets.forEach(dataset => {
          // Konversi format nama file ke format asli komoditas
          const komoditasName = dataset.komoditas
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          
          // Temukan komoditas yang sesuai dari list
          const matchedKomoditas = commodities.find(k => 
            k.toLowerCase() === komoditasName.toLowerCase());
          
          if (matchedKomoditas) {
            updatedDatasets[matchedKomoditas] = {
              uploaded: true,
              timestamp: dataset.timestamp,
              rowCount: dataset.rows,
              filename: dataset.filename
            };
          }
        });
        
        setUploadedDatasets(updatedDatasets);
      }
    } catch (error) {
      console.error('Error checking existing datasets:', error);
      setMessage({ 
        type: 'danger', 
        text: 'Gagal mendapatkan status dataset. Silakan refresh halaman.' 
      });
    }
  };
  
  // Fungsi untuk mengambil visualisasi
  const fetchVisualization = async (komoditas) => {
    if (!komoditas) return;
    try {
      const token = localStorage.getItem('token');
      const formattedKomoditas = komoditas.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
      
      // Tambahkan parameter type dan timestamp untuk menghindari cache
      const timestamp = new Date().getTime();
      const visualizationPath = `http://localhost:5000/api/admin/plot-image/${formattedKomoditas}?type=predictions&t=${timestamp}`;
      
      console.log(`Fetching visualization for ${komoditas}: ${visualizationPath}`);
      
      // Update state visualizations
      setVisualizations(prev => ({
        ...prev,
        [komoditas]: visualizationPath
      }));
    } catch (error) {
      console.error(`Error fetching visualization for ${komoditas}:`, error);
    }
  };  

  // Fungsi untuk mengambil semua visualisasi
  const fetchAllVisualizations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/admin/plot-images', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success' && data.plots) {
        const newVisualizations = {};
        
        // Konversi respons API ke format yang dibutuhkan state
        Object.entries(data.plots).forEach(([komoditas, plotData]) => {
          if (plotData.prediction_url) {
            newVisualizations[komoditas] = plotData.prediction_url;
          }
        });
        
        setVisualizations(newVisualizations);
        console.log('All visualizations updated:', newVisualizations);
      }
    } catch (error) {
      console.error('Error fetching all visualizations:', error);
    }
  };
  
  // Fetch training status
  const fetchTrainingStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': token ? `Bearer ${token}` : ''
      };
      
      const response = await fetch('http://localhost:5000/api/admin/training-status', {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Status error: ${response.status}`);
      }
      
      const data = await response.json();
      const statusData = data.training_status;
      
      setTrainingStatus(statusData);
      
      if (statusData && statusData.is_training) {
        setIsTraining(true);
        setTrainingProgress(statusData.progress || 0);
        
        // Mulai polling jika training sedang berjalan
        if (!statusIntervalRef.current) {
          statusIntervalRef.current = setInterval(fetchTrainingStatus, 5000);
        }
      } else {
        setIsTraining(false);
        
        // Jika baru saja selesai training, ambil visualisasi
        if (statusData && statusData.status === 'completed') {
          const komoditas = statusData.komoditas;
          if (komoditas) {
            fetchVisualization(komoditas);
          } else {
            // Jika training semua komoditas, ambil visualisasi untuk semua
            commodities.forEach(k => fetchVisualization(k));
          }
        }
        
        // Clear interval jika training sudah selesai
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error fetching training status:', error);
    }
  };
  
  // Fungsi untuk mendapatkan prediksi 30 hari ke depan
  const fetchFuturePrediction = async (komoditas) => {
    if (!komoditas) return;
    
    setLoadingPrediction(true);
    setPredictionResults([]);
    
    try {
      const token = localStorage.getItem('token');
      const formattedKomoditas = komoditas.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
      
      const response = await fetch(`http://localhost:5000/api/admin/predict-future/${formattedKomoditas}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setPredictionResults(data.predictions);
        setShowPredictionModal(true);
      } else {
        setMessage({
          type: 'danger',
          text: data.message || 'Gagal mendapatkan prediksi'
        });
      }
    } catch (error) {
      console.error(`Error fetching prediction for ${komoditas}:`, error);
      setMessage({
        type: 'danger',
        text: `Gagal mendapatkan prediksi: ${error.message}`
      });
    } finally {
      setLoadingPrediction(false);
    }
  };
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    
    // Set file info
    if (selectedFile) {
      setUploadedFileInfo({
        name: selectedFile.name,
        size: (selectedFile.size / 1024).toFixed(2) + ' KB',
        type: selectedFile.type,
        lastModified: new Date(selectedFile.lastModified).toLocaleString()
      });
    } else {
      setUploadedFileInfo(null);
    }
  };
  
  const handleKomoditasChange = (e) => {
    setKomoditas(e.target.value);
  };
  
  const handleTrainingKomoditasChange = (e) => {
    setSelectedKomoditasForTraining(e.target.value);
  };
  
  // Fungsi untuk menampilkan preview data
  const handleShowPreview = (result) => {
    setSelectedPreview(result);
    setShowPreviewModal(true);
  };
  
  // Handler untuk replace dataset
  const handleReplaceClick = (komoditas) => {
    setKomoditasToReplace(komoditas);
    setReplaceMode(true);
    setMessage({ type: 'info', text: `Pilih file CSV baru untuk mengganti dataset ${komoditas}` });
    
    // Set komoditas in dropdown
    setKomoditas(komoditas);
    
    // Scroll to upload form
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  
  // Handler untuk prediksi 30 hari
  const handleShowPrediction = (komoditas) => {
    setSelectedKomoditasPrediction(komoditas);
    fetchFuturePrediction(komoditas);
  };
  
  // Handler untuk delete dataset
  const handleDeleteClick = (komoditas) => {
    setKomoditasToDelete(komoditas);
    setShowDeleteConfirm(true);
    console.log('Delete button clicked for:', komoditas);
  };
  
  // Handler untuk konfirmasi delete
  const handleConfirmDelete = async () => {
    if (!komoditasToDelete) return;
    
    try {
      setMessage({ type: '', text: '' });
      
      const token = localStorage.getItem('token');
      const formattedKomoditas = komoditasToDelete.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
      
      console.log('Menghapus komoditas:', komoditasToDelete);
      console.log('Formatted komoditas:', formattedKomoditas);
      console.log('URL:', 'http://localhost:5000/api/admin/delete-dataset');
      
      const response = await fetch('http://localhost:5000/api/admin/delete-dataset', {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ komoditas: formattedKomoditas })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        // Update state untuk menandai dataset telah dihapus
        setUploadedDatasets(prev => ({
          ...prev,
          [komoditasToDelete]: {
            uploaded: false,
            timestamp: null,
            rowCount: 0
          }
        }));
        
        setMessage({ 
          type: 'success', 
          text: `Dataset ${komoditasToDelete} berhasil dihapus!` 
        });
        
        // Reset preprocessing status jika dataset dihapus
        if (preprocessingDone) {
          setPreprocessingDone(false);
          setPreprocessingResults([]);
        }
      } else {
        setMessage({
          type: 'danger',
          text: data.message || 'Terjadi kesalahan saat menghapus dataset'
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setMessage({
        type: 'danger',
        text: 'Gagal menghapus dataset: ' + error.message
      });
    } finally {
      setShowDeleteConfirm(false);
      setKomoditasToDelete('');
    }
  };
  
  // Handler untuk cancel delete
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setKomoditasToDelete('');
  };
  
  // Handler untuk upload dataset
  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!file || !komoditas) {
      setMessage({ type: 'danger', text: 'Pilih file CSV dan komoditas terlebih dahulu' });
      return;
    }
    
    // Update state untuk tracking progres komoditas ini
    setUploadProgress(prev => ({
      ...prev,
      [komoditas]: 0
    }));
    
    try {
      setUploading(true);
      setMessage({ type: '', text: '' });
      
      // Simulasi upload progress untuk komoditas ini
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev[komoditas] >= 90) {
            clearInterval(progressInterval);
            return {...prev, [komoditas]: 90};
          }
          return {...prev, [komoditas]: (prev[komoditas] || 0) + 10};
        });
      }, 300);
      
      // Buat form data untuk upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('komoditas', komoditas.toLowerCase().replace(/ /g, '_').replace(/-/g, '_'));
      
      // Ambil token dari local storage
      const token = localStorage.getItem('token');
      
      console.log('Mengirim file:', file.name);
      console.log('Ke komoditas:', komoditas);
      console.log('URL:', 'http://localhost:5000/api/admin/upload-csv');
      
      // Kirim file ke server
      const response = await fetch('http://localhost:5000/api/admin/upload-csv', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: formData
      });
      
      clearInterval(progressInterval);
      setUploadProgress(prev => ({...prev, [komoditas]: 100}));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        // Update state untuk menandai dataset telah diupload
        const updatedDatasets = {
          ...uploadedDatasets,
          [komoditas]: {
            uploaded: true,
            timestamp: data.timestamp || new Date().toISOString(),
            rowCount: data.rows || 0,
            filename: data.filename || file.name
          }
        };
        
        setUploadedDatasets(updatedDatasets);
        
        setMessage({ 
          type: 'success', 
          text: replaceMode 
            ? `Dataset ${komoditas} berhasil diganti!` 
            : `Dataset ${komoditas} berhasil diupload!` 
        });
        
        // Reset form
        setFile(null);
        setKomoditas('');
        setReplaceMode(false);
        setKomoditasToReplace('');
        setUploadedFileInfo(null);
        
        // Reset preprocessing status jika dataset diganti
        if (preprocessingDone) {
          setPreprocessingDone(false);
          setPreprocessingResults([]);
        }
        
        // Reset file input
        document.getElementById('fileInput').value = '';
        
        // Cek apakah semua dataset sudah diupload
        const allUploaded = Object.keys(updatedDatasets).length === commodities.length &&
          Object.values(updatedDatasets).every(status => status?.uploaded);
        
        // Jika semua dataset sudah diupload, langsung panggil fungsi preprocessing tanpa konfirmasi
        if (allUploaded) {
          handlePreprocessing();
        }
      } else {
        setMessage({
          type: 'danger',
          text: data.message || 'Terjadi kesalahan saat upload dataset'
        });
      }
      
      setTimeout(() => {
        setUploadProgress(prev => ({...prev, [komoditas]: 0}));
      }, 2000);
      
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({
        type: 'danger',
        text: 'Gagal mengupload file: ' + (error.message || 'Terjadi kesalahan sistem')
      });
    } finally {
      setUploading(false);
    }
  };
  
  // Handler untuk preprocessing data
  const handlePreprocessing = async () => {
    // Cek apakah semua dataset sudah diupload
    if (!allDatasetsUploaded) {
      setMessage({ 
        type: 'warning', 
        text: `Anda harus mengupload semua ${commodities.length} dataset terlebih dahulu.` 
      });
      return;
    }
    
    try {
      setIsPreprocessing(true);
      setPreprocessingProgress(0);
      setMessage({ type: '', text: '' });
      
      // Simulasi preprocessing progress
      const progressInterval = setInterval(() => {
        setPreprocessingProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 300);
      
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:5000/api/admin/preprocess-data', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})  // Kosong untuk memproses semua dataset
      });
      
      clearInterval(progressInterval);
      setPreprocessingProgress(100);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setMessage({ 
          type: 'success', 
          text: `${data.message}\n\nPreprocessing berhasil! Klik tombol "Train Model" untuk melanjutkan.` 
        });
        
        // Simpan hasil preprocessing
        setPreprocessingResults(data.results || []);
        
        // Set preprocessing berhasil
        setPreprocessingDone(true);
        setTimeout(() => {
          setPreprocessingProgress(0);
        }, 2000);
        
        // Langsung panggil fungsi training tanpa konfirmasi
        handleStartTraining();
      } else {
        setMessage({
          type: 'danger',
          text: data.message || 'Terjadi kesalahan saat preprocessing'
        });
      }
    } catch (error) {
      console.error('Preprocessing error:', error);
      setMessage({
        type: 'danger',
        text: 'Gagal melakukan preprocessing: ' + error.message
      });
    } finally {
      setIsPreprocessing(false);
    }
  };
  
  // Handler untuk memulai training model
  const handleStartTraining = async () => {
    if (!preprocessingDone) {
      setMessage({ 
        type: 'warning', 
        text: 'Anda harus melakukan preprocessing data terlebih dahulu.' 
      });
      return;
    }
    
    if (isTraining) {
      setMessage({ 
        type: 'warning', 
        text: 'Proses training sedang berjalan. Tunggu hingga selesai.' 
      });
      return;
    }
    
    try {
      setMessage({ type: '', text: '' });
      
      const token = localStorage.getItem('token');
      const formattedKomoditas = selectedKomoditasForTraining ? 
        selectedKomoditasForTraining.toLowerCase().replace(/ /g, '_').replace(/-/g, '_') : null;
      
      const response = await fetch('http://localhost:5000/api/admin/train-model', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ komoditas: formattedKomoditas })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setMessage({ type: 'success', text: 'Proses training model telah dimulai' });
        setIsTraining(true);
        setTrainingStatus(data.training_status);
        setTrainingProgress(0);
        
        // Mulai polling untuk update status
        statusIntervalRef.current = setInterval(fetchTrainingStatus, 5000);
      } else {
        setMessage({
          type: 'danger',
          text: data.message || 'Terjadi kesalahan saat memulai training'
        });
      }
    } catch (error) {
      console.error('Training error:', error);
      setMessage({
        type: 'danger',
        text: 'Gagal memulai training: ' + error.message
      });
    }
  };
  
  // Helper function untuk render pesan dengan line breaks
  const renderMessage = (message) => {
    return message.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < message.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };
  
  // Helper function untuk format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Hitung jumlah dataset yang sudah diupload
  const uploadedCount = Object.values(uploadedDatasets).filter(status => status?.uploaded).length;
  
  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h2>LSTM Model Update</h2>
          </div>
          <hr />
          <p className="workflow-description">
            Proses:
            <Badge bg={allDatasetsUploaded ? "success" : "primary"} className="mx-2">
              1. Upload 11 Dataset ({uploadedCount}/{commodities.length})
            </Badge> → 
            <Badge bg={preprocessingDone ? "success" : allDatasetsUploaded ? "primary" : "secondary"} className="mx-2">
              2. Preprocess Data
            </Badge> → 
            <Badge bg={isTraining ? "warning" : (preprocessingDone ? "primary" : "secondary")} className="mx-2">
              3. Train Model
            </Badge>
          </p>
        </Col>
      </Row>
      
      {message.text && (
        <Row className="mb-3">
          <Col>
            <Alert 
              variant={message.type} 
              dismissible 
              onClose={() => setMessage({type: '', text: ''})}
            >
              {renderMessage(message.text)}
            </Alert>
          </Col>
        </Row>
      )}
      
      {/* Konfirmasi Delete */}
      {showDeleteConfirm && (
        <Row className="mb-3">
          <Col>
            <Alert 
              variant="danger"
              className="d-flex justify-content-between align-items-center"
            >
              <div>
                <strong>Konfirmasi Hapus:</strong> Apakah Anda yakin ingin menghapus dataset {komoditasToDelete}?
              </div>
              <div>
                <Button 
                  variant="outline-danger" 
                  size="sm" 
                  className="me-2"
                  onClick={handleConfirmDelete}
                >
                  Ya, Hapus
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={handleCancelDelete}
                >
                  Batal
                </Button>
              </div>
            </Alert>
          </Col>
        </Row>
      )}
      {/* Info dari mana data diambil */}
      <div className="info-panel">
        <h3>Informasi Dataset</h3>
        <p>Dataset yang di upload harus memiliki nama yang sama dengan dataset sebelumnya.</p>
        <p>Hal ini karena proses training ulang menggunakan pemanggilan dataset pada nama yang sama.</p>
        <p>Setiap dataset baru yang di upload akan otomatis menggantikan dataset lama.</p>
      </div>

      <Row>
        <Col>
          <Card className="mb-4">
            <Card.Body>
              {/* Step 1: Upload Dataset */}
              <div className="step-container">
                <div className="step-header">
                  <h3>
                    {replaceMode 
                      ? `Ganti Dataset: ${komoditasToReplace}` 
                      : `1. Upload All 11 Datasets (${uploadedCount}/${commodities.length})`
                    }
                  </h3>
                  {allDatasetsUploaded && !replaceMode && <Badge bg="success">Completed</Badge>}
                  {replaceMode && <Badge bg="warning">Mode Penggantian</Badge>}
                </div>
                
                <div className="step-content">
                  <Form onSubmit={handleUpload}>
                    <Row>
                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label>Pilih Komoditas</Form.Label>
                          <Form.Select
                            value={komoditas}
                            onChange={handleKomoditasChange}
                            required
                            disabled={uploading || isPreprocessing || isTraining || replaceMode}
                          >
                            <option value="">-- Pilih Komoditas --</option>
                            {commodities.map((item, index) => (
                              <option 
                                key={index} 
                                value={item}
                                disabled={uploadedDatasets[item]?.uploaded && !replaceMode}
                              >
                                {item} {uploadedDatasets[item]?.uploaded && !replaceMode ? '(Sudah diupload)' : ''}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      
                      <Col md={5}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            {replaceMode ? 'Pilih File CSV Baru' : 'File CSV'}
                          </Form.Label>
                          <Form.Control
                            id="fileInput"
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            required
                            disabled={uploading || isPreprocessing || isTraining}
                          />
                          <Form.Text className="text-muted">
                            Format: Tanggal;Harga
                          </Form.Text>
                        </Form.Group>
                        
                        {/* Tampilkan informasi file yang diupload */}
                        {uploadedFileInfo && (
                          <div className="file-info my-2 p-2 border rounded bg-light">
                            <h6>File Information:</h6>
                            <p className="mb-0"><strong>Name:</strong> {uploadedFileInfo.name}</p>
                            <p className="mb-0"><strong>Size:</strong> {uploadedFileInfo.size}</p>
                            <p className="mb-0"><strong>Type:</strong> {uploadedFileInfo.type}</p>
                            <p className="mb-0"><strong>Last Modified:</strong> {uploadedFileInfo.lastModified}</p>
                          </div>
                        )}
                      </Col>
                      
                      <Col md={3} className="d-flex align-items-end">
                        <Button 
                          variant={replaceMode ? "warning" : "primary"}
                          type="submit" 
                          className="mb-3 w-100"
                          disabled={uploading || isPreprocessing || isTraining}
                        >
                          {uploading 
                            ? 'Mengupload...' 
                            : replaceMode 
                              ? 'Ganti Dataset' 
                              : 'Upload Dataset'
                          }
                        </Button>
                        
                        {replaceMode && (
                          <Button 
                            variant="outline-secondary" 
                            className="mb-3 ms-2"
                            onClick={() => {
                              setReplaceMode(false);
                              setKomoditasToReplace('');
                              setKomoditas('');
                              setFile(null);
                              setUploadedFileInfo(null);
                              document.getElementById('fileInput').value = '';
                            }}
                          >
                            Batal
                          </Button>
                        )}
                      </Col>
                    </Row>
                  </Form>
                  
                  {uploadProgress[komoditas] > 0 && (
                    <ProgressBar 
                      now={uploadProgress[komoditas]} 
                      label={`${uploadProgress[komoditas]}%`}
                      variant="primary"
                      className="mb-3"
                    />
                  )}
                  
                  {/* Dataset Status Table */}
                  <div className="mt-3">
                    <h5>Status Dataset</h5>
                    <div className="dataset-table-container">
                      <Table striped bordered hover size="sm" className="dataset-table">
                        <thead>
                          <tr>
                            <th>No</th>
                            <th>Komoditas</th>
                            <th>Status</th>
                            <th>File Name</th>
                            <th>Jumlah Data</th>
                            <th>Waktu Upload</th>
                            <th>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commodities.map((item, index) => (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td>{item}</td>
                              <td>
                                <Badge bg={uploadedDatasets[item]?.uploaded ? "success" : "secondary"}>
                                  {uploadedDatasets[item]?.uploaded ? "Uploaded" : "Not Uploaded"}
                                </Badge>
                              </td>
                              <td>{uploadedDatasets[item]?.filename || '-'}</td>
                              <td>{uploadedDatasets[item]?.rowCount || '-'}</td>
                              <td>{formatTimestamp(uploadedDatasets[item]?.timestamp)}</td>
                              
                              <td>
                                {uploadedDatasets[item]?.uploaded && (
                                  <div className="d-flex">
                                    <Button 
                                      variant="outline-warning" 
                                      size="sm" 
                                      className="me-1"
                                      onClick={() => handleReplaceClick(item)}
                                      disabled={isPreprocessing || isTraining || uploading}
                                    >
                                      <i className="fa fa-refresh"></i> Ganti
                                    </Button>
                                    
                                    <Button 
                                      variant="outline-danger" 
                                      size="sm"
                                      onClick={() => handleDeleteClick(item)}
                                      disabled={isPreprocessing || isTraining || uploading}
                                    >
                                      <i className="fa fa-trash"></i> Hapus
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
              
              <hr className="step-divider" />
              
              {/* Step 2: Preprocess Data */}
              <div className="step-container">
                <div className="step-header">
                  <h3>2. Preprocess Data</h3>
                  {preprocessingDone && <Badge bg="success">Completed</Badge>}
                </div>
                
                <div className="step-content">
                  <Row>
                    <Col md={9}>
                      <p>
                        Preprocessing akan mempersiapkan dataset untuk digunakan dalam training model.
                        Proses ini akan dijalankan pada {allDatasetsUploaded ? 'semua dataset yang tersedia' : 'dataset yang tersedia'}.
                        {!allDatasetsUploaded && (
                          <span className="text-warning"> Anda harus mengupload semua dataset terlebih dahulu!</span>
                        )}
                      </p>
                      
                      {preprocessingResults.length > 0 && (
                        <div className="mt-2 mb-3">
                          <h6>Hasil Preprocessing:</h6>
                          <div className="preprocessing-results-container">
                            <Table striped bordered hover size="sm">
                              <thead>
                                <tr>
                                  <th>Komoditas</th>
                                  <th>Status</th>
                                  <th>Jumlah Data</th>
                                  <th>Waktu Proses</th>
                                  <th>Aksi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {preprocessingResults.map((result, index) => (
                                  <tr key={index} className={result.status === 'success' ? '' : 'table-danger'}>
                                    <td>{result.komoditas}</td>
                                    <td>
                                      <Badge bg={result.status === 'success' ? 'success' : 'danger'}>
                                        {result.status === 'success' ? 'Berhasil' : 'Gagal'}
                                      </Badge>
                                    </td>
                                    <td>{result.rows || '-'}</td>
                                    <td>{result.processing_time ? `${result.processing_time}s` : '-'}</td>
                                    <td>
                                      {result.status === 'success' ? (
                                        <Button 
                                          variant="outline-info" 
                                          size="sm"
                                          onClick={() => handleShowPreview(result)}
                                        >
                                          Preview
                                        </Button>
                                      ) : (
                                        <div className="text-danger small">{result.error}</div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </Col>
                    
                    <Col md={3} className="d-flex align-items-start">
                      <Button 
                        variant={preprocessingDone ? "success" : "primary"}
                        onClick={handlePreprocessing}
                        className="w-100"
                        disabled={!allDatasetsUploaded || isPreprocessing || isTraining}
                      >
                        {isPreprocessing ? 'Preprocessing...' : (preprocessingDone ? 'Preprocessing Selesai' : 'Preprocess Data')}
                      </Button>
                    </Col>
                  </Row>
                  
                  {preprocessingProgress > 0 && (
                    <ProgressBar 
                      now={preprocessingProgress} 
                      label={`${preprocessingProgress}%`}
                      variant="primary"
                      className="mt-3"
                    />
                  )}
                </div>
              </div>
              
              <hr className="step-divider" />
              
              {/* Step 3: Train Model */}
              <div className="step-container">
                <div className="step-header">
                  <h3>3. Train Model</h3>
                  {trainingStatus && trainingStatus.status === 'completed' && <Badge bg="success">Completed</Badge>}
                </div>
                
                <div className="step-content">
                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Mode Training</Form.Label>
                        <div className="training-info">
                          <div className="alert alert-info">
                            <i className="bi bi-info-circle-fill me-2"></i>
                            <span>Sistem akan melatih model untuk semua komoditas</span>
                          </div>
                        </div>
                        {/* <Form.Text className="text-muted">
                          Proses training akan dilakukan untuk seluruh komoditas
                        </Form.Text> */}
                      </Form.Group>
                    </Col>
                    
                    <Col md={5}>
                      <Form.Group className="mb-3">
                      <Form.Label>Training Status</Form.Label>
                      {isTraining && trainingStatus && (
                        <div className="training-status">
                          <div className="d-flex justify-content-between mb-2">
                            <span>Komoditas: {trainingStatus.komoditas || 'Semua'}</span>
                            <span>Status: {trainingStatus.status}</span>
                          </div>
                          {trainingStatus.message && (
                            <p className="mb-2 small">{trainingStatus.message}</p>
                          )}
                        </div>
                      )}
                      </Form.Group>
                    </Col>
                    
                    <Col md={3} className="d-flex align-items-end">
                      <Button 
                        variant={isTraining ? "warning" : "primary"}
                        onClick={handleStartTraining}
                        className="mb-3 w-100"
                        disabled={!preprocessingDone || isTraining}
                      >
                        {isTraining ? 'Training Berjalan...' : 'Train Model'}
                      </Button>
                    </Col>
                  </Row>
                  
                  {isTraining && (
                    <ProgressBar 
                      now={trainingProgress} 
                      label={`${trainingProgress}%`}
                      variant={
                        trainingStatus?.status === 'failed' ? 'danger' :
                        trainingStatus?.status === 'completed' ? 'success' : 'warning'
                      }
                      striped={isTraining && trainingStatus?.status !== 'completed'}
                      animated={isTraining && trainingStatus?.status !== 'completed'}
                    />
                  )}
                  
                  {/* Visualisasi Hasil Training */}
                  {!isTraining && trainingStatus && trainingStatus.status === 'completed' && (
                    <div className="visualizations-container mt-4">
                      <h4>Hasil Training</h4>
                      
                      <Row className="mb-3">
                        <Col>
                          <Alert variant="success">
                            Training model telah selesai. Anda dapat melihat hasil visualisasi dan membuat prediksi 30 hari ke depan.
                          </Alert>
                        </Col>
                      </Row>
                      
                      <Tabs defaultActiveKey="visualizations" id="training-tabs" className="mb-3">
                        <Tab eventKey="visualizations" title="Visualisasi Model">
                          <Row>
                          {Object.entries(visualizations).map(([komoditas, imageSrc]) => (
                              <Col md={6} key={komoditas} className="mb-3">
                                <Card>
                                  <Card.Header className="d-flex justify-content-between align-items-center">
                                    <span>{komoditas}</span>
                                    <div>
                                      <Badge bg="success" className="me-2">Model Trained</Badge>
                                      <Button 
                                        variant="outline-primary" 
                                        size="sm"
                                        onClick={() => handleShowPrediction(komoditas)}
                                        disabled={loadingPrediction}
                                      >
                                        {loadingPrediction && selectedKomoditasPrediction === komoditas ? 'Loading...' : 'Prediksi 30 Hari'}
                                      </Button>
                                    </div>
                                  </Card.Header>
                                  <Card.Body className="p-0 position-relative">
                                    <img 
                                      src={imageSrc} 
                                      alt={`Visualisasi model ${komoditas}`} 
                                      className="img-fluid"
                                      style={{width: '100%'}}
                                      onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = 'https://via.placeholder.com/800x400?text=Visualisasi+Tidak+Tersedia';
                                      }}
                                    />
                                    <div className="refresh-overlay">
                                      <Button 
                                        variant="light" 
                                        size="sm" 
                                        className="refresh-button"
                                        onClick={() => fetchVisualization(komoditas)}
                                      >
                                        <i className="fa fa-refresh"></i> Refresh
                                      </Button>
                                    </div>
                                  </Card.Body>
                                </Card>
                              </Col>
                            ))}
                            {Object.keys(visualizations).length === 0 && (
                              <Col>
                                <Alert variant="info">
                                  Belum ada visualisasi tersedia. Jalankan training untuk melihat hasil.
                                </Alert>
                              </Col>
                            )}
                          </Row>
                        </Tab>
                        
                        <Tab eventKey="models" title="Model Information">
                          <div className="model-info-container">
                            <Table striped bordered hover>
                              <thead>
                                <tr>
                                  <th>Komoditas</th>
                                  <th>Model Architecture</th>
                                  <th>Loss</th>
                                  <th>Accuracy</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {commodities.map((item, index) => (
                                  <tr key={index}>
                                    <td>{item}</td>
                                    <td>LSTM (50 units, 2 layers)</td>
                                    <td>MSE</td>
                                    <td>MAE: ~2-5%</td>
                                    <td>
                                      <Button 
                                        variant="outline-primary" 
                                        size="sm"
                                        onClick={() => handleShowPrediction(item)}
                                        disabled={loadingPrediction || !Object.keys(visualizations).includes(item)}
                                      >
                                        {loadingPrediction && selectedKomoditasPrediction === item ? 'Loading...' : 'Prediksi 30 Hari'}
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        </Tab>
                      </Tabs>
                    </div>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Modal untuk preview data */}
      <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Preview Data: {selectedPreview?.komoditas}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedPreview && (
            <>
              <h6>Data setelah preprocessing:</h6>
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Harga</th>
                    {selectedPreview.preview_data && selectedPreview.preview_data[0]?.Harga_Normalized !== undefined && (
                      <th>Harga Normalized</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selectedPreview.preview_data && selectedPreview.preview_data.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.Tanggal}</td>
                      <td>
                        {typeof item.Harga === 'number' ? 
                          Math.round(item.Harga).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : 
                          item.Harga
                        }
                      </td>
                      {item.Harga_Normalized !== undefined && (
                        <td>{item.Harga_Normalized.toFixed(4)}</td>
                      )}
                    </tr>
                  ))}
                  {(!selectedPreview.preview_data || selectedPreview.preview_data.length === 0) && (
                    <tr>
                      <td colSpan="3" className="text-center">Tidak ada preview data tersedia</td>
                    </tr>
                  )}
                </tbody>
              </Table>
              
              {selectedPreview.original_sample && (
                <>
                  <h6 className="mt-3">Sample data asli:</h6>
                  <pre className="bg-light p-2 rounded" style={{maxHeight: '200px', overflow: 'auto'}}>
                    {selectedPreview.original_sample}
                  </pre>
                </>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Modal untuk prediksi 30 hari */}
      <Modal show={showPredictionModal} onHide={() => setShowPredictionModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Prediksi 30 Hari Ke Depan: {selectedKomoditasPrediction}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {predictionResults.length > 0 ? (
            <>
              <div className="mb-4">
                <h6>Grafik Prediksi Harga 30 Hari Ke Depan</h6>
                <div style={{ height: '300px' }}>
                  {/* Chart bisa menggunakan library chart.js atau recharts */}
                  {/* Ini hanya placeholder, perlu disesuaikan dengan library chart yang Anda gunakan */}
                  <div style={{ width: '100%', height: '100%', background: '#f8f9fa', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <p style={{ textAlign: 'center' }}>
                      Grafik Prediksi<br />
                      (Implementasikan dengan Chart.js atau Recharts)
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h6>Tabel Prediksi Harga 30 Hari Ke Depan</h6>
                <div className="table-responsive" style={{ maxHeight: '400px' }}>
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Tanggal</th>
                        <th>Prediksi Harga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictionResults.map((item, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>{item.tanggal}</td>
                          <td>
                            Rp {Math.round(item.prediksi).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            </>
          ) : (
            <Alert variant="info">
              {loadingPrediction 
                ? 'Memuat prediksi...' 
                : 'Tidak ada hasil prediksi tersedia. Coba lagi nanti.'}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPredictionModal(false)}>
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AdminModelTraining;
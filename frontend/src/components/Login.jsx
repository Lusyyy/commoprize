import React, { useState, useContext } from 'react';
import { Form, Button, Container, Row, Col, Card, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('Username dan password diperlukan');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      const user = await login(username, password);
      
      if (user.is_admin) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="mt-5">
      <Row className="justify-content-center">
        <Col md={6}>
          <Card>
            <Card.Header className="text-center bg-primary text-white">
              <h4>Commoprize Login</h4>
            </Card.Header>
            <Card.Body>
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Form.Group>

                <div className="d-grid gap-2">
                  <Button 
                    variant="primary" 
                    type="submit" 
                    disabled={loading}
                  >
                    {loading ? 'Memproses...' : 'Login'}
                  </Button>
                </div> 
                <div className='text-center'>
                  Belum punya akun? <Link to="/register">Register di sini</Link>
                </div>
              </Form>
            </Card.Body>
            {/* <Card.Footer className="text-center">
              Belum punya akun? <Link to="/register">Register di sini</Link>
            </Card.Footer> */}
            {/* <Card.Footer className="text-center text-muted">
              <small>Demo Credentials:<br />Admin: admin/admin123 | User: user/user123</small>
            </Card.Footer> */}
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Login;
import React, { useContext } from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const NavBar = () => {
  const { currentUser, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  return (
    <Navbar bg="primary" variant="dark" expand="lg" className="mb-4">
      <Container>
        <Navbar.Brand as={Link} to="/">Commoprize</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {/* Link Prediksi untuk semua user */}
            <Nav.Link as={Link} to="/predict">Prediksi Harga</Nav.Link>

            {/* <Nav.Link as={Link} to="/">Home</Nav.Link> */}
            {currentUser && currentUser.is_admin && (
              <>
                <Nav.Link as={Link} to="/scraping">Scraping Data</Nav.Link>
                <Nav.Link as={Link} to="/admin">Model Update</Nav.Link>
                <Nav.Link as={Link} to="/admin/history">Model Training History</Nav.Link>
              </>
            )}
          </Nav>
          <Nav>
            {currentUser ? (
              <>
                <Navbar.Text className="me-3">
                  Halo, <b>{currentUser.username}</b>
                  {currentUser.is_admin && (
                    <span className="ms-2 badge bg-warning text-dark">Admin</span>
                  )}
                </Navbar.Text>
                <Button variant="outline-light" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : 
            (
              <Nav.Link as={Link} to="/login">Login</Nav.Link>
            )
            }
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default NavBar;
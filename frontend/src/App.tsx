/* ========================================
   App — Main Router & Layout
   ======================================== */

import { useState, useCallback } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import ReviewForm from './components/ReviewForm';
import { ToastContainer } from './components/Toast';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Managers from './pages/Managers';
import ManagerProfile from './pages/ManagerProfile';
import Pricing from './pages/Pricing';
import Contact from './pages/Contact';
import Admin from './pages/Admin';

export default function App() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [prefillName, setPrefillName] = useState('');
  const [prefillLinkedin, setPrefillLinkedin] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();

  const openReview = useCallback((name?: string, linkedin?: string) => {
    setPrefillName(name || '');
    setPrefillLinkedin(linkedin || '');
    setReviewOpen(true);
  }, []);

  const handleWriteReview = useCallback(() => {
    openReview();
  }, [openReview]);

  // Admin page renders its own full-screen layout (no Header)
  const isAdminRoute = location.pathname === '/admin';

  if (isAdminRoute) {
    return (
      <>
        <Routes>
          <Route path="/admin" element={<Admin />} />
        </Routes>
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onWriteReview={handleWriteReview} onSearch={setSearchQuery} />

      <main>
        <Routes>
          <Route path="/" element={<Home onWriteReview={handleWriteReview} />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/managers" element={<Managers searchQuery={searchQuery} />} />
          <Route path="/managers/:id" element={<ManagerProfile onWriteReview={openReview} />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>

      <ReviewForm
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        prefillName={prefillName}
        prefillLinkedin={prefillLinkedin}
      />

      <ToastContainer />
    </div>
  );
}

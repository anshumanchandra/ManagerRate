/* ========================================
   Header — Sticky navigation with search
   ======================================== */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

interface HeaderProps {
  onWriteReview: () => void;
  onSearch: (q: string) => void;
}

export default function Header({ onWriteReview, onSearch }: HeaderProps) {
  const [searchVal, setSearchVal] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const handleSearch = (val: string) => {
    setSearchVal(val);
    if (val.length > 0) {
      navigate('/managers');
      onSearch(val);
    } else {
      onSearch('');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-navy via-blue-700 to-blue-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top row */}
        <div className="flex items-center justify-between py-3">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight hover:opacity-90 transition">
            <i className="fa-solid fa-building-user text-xl opacity-90" />
            <span>ManagerRate</span>
          </Link>

          {/* Search */}
          <div className="hidden sm:flex items-center bg-white/15 border border-white/25 rounded-lg px-3 py-1.5 w-80 focus-within:bg-white/25 focus-within:border-white/50 transition-all focus-within:w-96">
            <i className="fa-solid fa-magnifying-glass text-white/60 mr-2 text-xs" />
            <input
              type="text"
              value={searchVal}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search managers by name or company..."
              className="bg-transparent border-none text-white text-sm w-full outline-none placeholder:text-white/50"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* For Business badge */}
            <Link
              to="/pricing"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/20 border border-yellow-400/40 rounded-lg text-xs font-bold text-yellow-300 hover:bg-yellow-400/30 transition"
            >
              <i className="fa-solid fa-crown text-[10px]" />
              For Business
            </Link>

            <button
              onClick={onWriteReview}
              className="flex items-center gap-2 px-4 py-2 bg-white/15 border border-white/30 rounded-lg text-sm font-semibold hover:bg-white/25 transition"
            >
              <i className="fa-solid fa-pen" />
              Write a Review
            </button>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="flex gap-0 max-w-7xl mx-auto overflow-x-auto">
          {[
            { to: '/', label: 'Home', icon: 'fa-house' },
            { to: '/dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
            { to: '/managers', label: 'Managers', icon: 'fa-users' },
            { to: '/pricing', label: 'Pricing', icon: 'fa-tag' },
          ].map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className={`px-4 py-2 text-sm font-medium border-b-[3px] transition-colors whitespace-nowrap ${
                isActive(tab.to)
                  ? 'text-white border-white'
                  : 'text-white/60 border-transparent hover:text-white'
              }`}
            >
              <i className={`fa-solid ${tab.icon} mr-1.5`} />
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

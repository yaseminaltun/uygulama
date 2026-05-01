import React from 'react';
import ReactDOM from 'react-dom/client';
import { Activity, CalendarDays, Car, Home } from 'lucide-react';
import App from './App.jsx';
import './styles/global.css';

const navItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'tennis', label: 'Tennis', icon: Activity },
  { id: 'f1', label: 'F1', icon: Car },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays }
];

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App navItems={navItems} />
  </React.StrictMode>
);

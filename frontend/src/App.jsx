import React from "react";
import { useState } from 'react';
import Layout from './components/Layout.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import F1Page from './pages/F1Page.jsx';
import HomePage from './pages/HomePage.jsx';
import TennisPage from './pages/TennisPage.jsx';

const pages = {
  home: HomePage,
  tennis: TennisPage,
  f1: F1Page,
  calendar: CalendarPage
};

export default function App({ navItems }) {
  const [activePage, setActivePage] = useState('home');
  const Page = pages[activePage];

  return (
    <Layout navItems={navItems} activePage={activePage} onNavigate={setActivePage}>
      <Page />
    </Layout>
  );
}

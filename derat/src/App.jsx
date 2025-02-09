import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import InterfaceSwitcher from './components/InterfaceSwitcher';
import './App.css';

const App = () => {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/*" element={<InterfaceSwitcher />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { EmployeeFormProvider } from './EmployeeFormProvider';
import EmployeeNameStep from './EmployeeNameStep';
import SelectClientStep from './SelectClientStep';
import SelectOperationStep from './SelectOperationStep';
import ClientRepresentativeStep from './ClientRepresentativeStep';
import SummaryAndSignatureStep from './SummaryAndSignatureStep';
import ConfirmationStep from './ConfirmationStep';
import './EmployeeView.css';

const EmployeeView = () => {
  return (
    <EmployeeFormProvider>
      <div className="employee-view">
        <h2></h2>
        <Routes>
          <Route path="/" element={<Navigate to="step1" />} />
          <Route path="step1" element={<EmployeeNameStep />} />
          <Route path="step2" element={<SelectClientStep />} />
          <Route path="step3" element={<SelectOperationStep />} />
          <Route path="step4" element={<ClientRepresentativeStep />} />
          <Route path="step5" element={<SummaryAndSignatureStep />} />
          <Route path="confirmation" element={<ConfirmationStep />} />
        </Routes>
      </div>
    </EmployeeFormProvider>
  );
};

export default EmployeeView;
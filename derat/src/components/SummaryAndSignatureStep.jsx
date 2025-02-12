import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { useEmployeeForm } from './EmployeeFormProvider';
import { PDFDocument, rgb } from 'pdf-lib';
import './SummaryAndSignatureStep.css';

const SummaryAndSignatureStep = () => {
  const { formData, updateFormData } = useEmployeeForm();
  const sigCanvas = useRef(null);
  const navigate = useNavigate();
  const [employeeSignature, setEmployeeSignature] = useState('');

  const handleFinish = async () => {
    if (!employeeSignature) {
      alert('Please provide your signature.');
      return;
    }

    const finalData = {
      ...formData,
      employeeSignature
    };

    await generateAndSendPDF(finalData);
    navigate('/employee/completed');
  };

  const handleBack = () => {
    navigate('/employee/step4');
  };

  const handleClear = () => {
    sigCanvas.current.clear();
    setEmployeeSignature('');
  };

  const handleSignatureEnd = () => {
    setEmployeeSignature(sigCanvas.current.toDataURL());
  };

  const generateAndSendPDF = async (data) => {
    const templateUrl = `${window.location.origin}/assets/template.pdf`;
    const existingPdfBytes = await fetch(templateUrl).then(res => res.arrayBuffer());

    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const { width, height } = firstPage.getSize();

    firstPage.drawText(`Name: ${data.employeeName}`, {
      x: 20,
      y: height - 50,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`ID Series: ${data.employeeIDSeries}`, {
      x: 20,
      y: height - 70,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`ID Number: ${data.employeeIDNumber}`, {
      x: 20,
      y: height - 90,
      size: 12,
      color: rgb(0, 0, 0),
    });

    firstPage.drawText(`Client Name: ${data.customer.name}`, {
      x: 20,
      y: height - 110,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`Email: ${data.customer.email}`, {
      x: 20,
      y: height - 130,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`Phone: ${data.customer.phone}`, {
      x: 20,
      y: height - 150,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`Contract Number: ${data.customer.contract_number}`, {
      x: 20,
      y: height - 170,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`Location: ${data.customer.location}`, {
      x: 20,
      y: height - 190,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`Surface: ${data.customer.surface}`, {
      x: 20,
      y: height - 210,
      size: 12,
      color: rgb(0, 0, 0),
    });

    let yOffset = height - 230;
    data.operations.forEach((operation, index) => {
      firstPage.drawText(`Operation: ${operation}`, {
        x: 20,
        y: yOffset,
        size: 12,
        color: rgb(0, 0, 0),
      });
      yOffset -= 20;
      firstPage.drawText(`Solutions: ${data.solutions[operation]?.map(sol => sol.label).join(', ')}`, {
        x: 20,
        y: yOffset,
        size: 12,
        color: rgb(0, 0, 0),
      });
      yOffset -= 20;
      firstPage.drawText(`Quantity: ${data.quantities[operation]}`, {
        x: 20,
        y: yOffset,
        size: 12,
        color: rgb(0, 0, 0),
      });
      yOffset -= 20;
    });

    firstPage.drawText(`Representative Name: ${data.clientRepresentative}`, {
      x: 20,
      y: yOffset,
      size: 12,
      color: rgb(0, 0, 0),
    });
    yOffset -= 40;

    const clientSigImage = await pdfDoc.embedPng(data.clientSignature);
    firstPage.drawImage(clientSigImage, {
      x: 20,
      y: yOffset,
      width: 100,
      height: 50,
    });
    yOffset -= 60;

    firstPage.drawText('Employee Signature:', {
      x: 20,
      y: yOffset,
      size: 12,
      color: rgb(0, 0, 0),
    });
    yOffset -= 40;

    const empSigImage = await pdfDoc.embedPng(data.employeeSignature);
    firstPage.drawImage(empSigImage, {
      x: 20,
      y: yOffset,
      width: 100,
      height: 50,
    });

    const pdfBytes = await pdfDoc.save();

    let customerEmail = formData.customer.email;

    try {
      const response = await fetch('/derat/api/send-email.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfBytes,
          customerEmail
        })
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      console.log('Email sent successfully');
      return data;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }

    // const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    // const link = document.createElement('a');
    // link.href = URL.createObjectURL(blob);
    // link.download = "dog.pdf";
    // document.body.appendChild(link);
    // link.click();
    // document.body.removeChild(link);
  };

  return (
    <div className="summary-step">
      <h2>Summary</h2>
      <div className="summary-details">
        <h3>Employee Details</h3>
        <p>Name: {formData.employeeName}</p>
        <p>ID Series: {formData.employeeIDSeries}</p>
        <p>ID Number: {formData.employeeIDNumber}</p>

        <h3>Client Details</h3>
        <p>Name: {formData.customer.name}</p>
        <p>Email: {formData.customer.email}</p>
        <p>Phone: {formData.customer.phone}</p>
        <p>Contract Number: {formData.customer.contract_number}</p>
        <p>Location: {formData.customer.location}</p>
        <p>Surface: {formData.customer.surface}</p>

        <h3>Operations</h3>
        {formData.operations.map((operation, index) => (
          <div key={index}>
            <p>Operation: {operation}</p>
            <p>Solutions: {formData.solutions[operation]?.map(sol => sol.label).join(', ')}</p>
            <p>Quantity: {formData.quantities[operation]}</p>
          </div>
        ))}

        <h3>Client Representative</h3>
        <p>Representative Name: {formData.clientRepresentative}</p>
        <img src={formData.clientSignature} alt="Client Signature" className="signature-image"/>
      </div>

      <div className="signature">
        <h3>Your Signature</h3>
        <SignatureCanvas 
          ref={sigCanvas} 
          onEnd={handleSignatureEnd}
          canvasProps={{ className: 'sigCanvas' }} 
        />
        <button className="clear-signature-button" onClick={handleClear}>Clear Signature</button>
      </div>

      <div className="navigation-buttons">
        <button onClick={handleBack}>Back</button>
        <button onClick={handleFinish}>Finish</button>
      </div>
    </div>
  );
};

export default SummaryAndSignatureStep;
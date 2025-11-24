import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import supabase from '../../supabaseClient';

export const fetchSolutionUnitOfMeasure = async (id) => {
  const { data, error } = await supabase
    .from('solutions')
    .select('unit_of_measure')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching reception number:', error);
    return null;
  }
  
  return data.unit_of_measure;
};

export const fillTemplate = async (templateUrl, request) => {
  try {
    // Fetch and load the existing PDF template
    const response = await fetch(templateUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF template: ${response.statusText}`);
    }

    const existingPdfBytes = await response.arrayBuffer();

    console.log('PDF Bytes Length:', existingPdfBytes.byteLength);

    // Ensure the PDF file has a valid header
    const fileHeader = new Uint8Array(existingPdfBytes.slice(0, 4));
    const headerString = String.fromCharCode.apply(null, fileHeader);
    if (headerString !== '%PDF') {
      throw new Error(`Invalid PDF header: ${headerString}`);
    }

    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Get the first page of the document
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { height } = firstPage.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;

    // Function to draw text in the PDF
    const drawText = (text, x, y, color = rgb(0, 0, 0)) => {
      firstPage.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color,
      });
    };

    console.log('Request data in fillTemplate:', request);

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '.');
    const formattedTime = now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    drawText(`${request.receptionNumber}`, 505, height - 112);
    drawText(`${formattedDate}`, 400, height - 135);
    drawText(`${formattedTime}`, 475, height - 135);
    drawText(`${request.client.name}`, 160, height - 180);
    drawText(`${request.client.contract_number}`, 525, height - 180);
    drawText(`${request.client.location}`, 200, height - 202);
    drawText(`${request.client.surface}`, 590, height - 202); // Added Suprafat client

    // Draw client representative just under the contact info and embed
    // the client's signature directly below it so it appears under the
    // contact block (not elsewhere on the page).
    drawText(`${request.clientRepresentative}`, 160, height - 520);

    if (request.clientSignature) {
      try {
        const clientSignatureImage = await pdfDoc.embedPng(request.clientSignature);
        firstPage.drawImage(clientSignatureImage, {
          x: 160,
          y: height - 580,
          width: 150,
          height: 50,
        });
      } catch (e) {
        console.warn('Could not embed client signature image into PDF:', e);
      }
    } else {
      // If not provided, leave the area blank (no misleading text)
    }

    // Draw employee information in blue
    const blueGreenColor = rgb(0, 0.1, 0.3);
    drawText(` ${request.employeeName}`, 540, height - 530, blueGreenColor);
    drawText(` ${request.employeeIDSeries}`, 550, height - 540, blueGreenColor); // Add ID series

    // Embed and draw the employee's signature
    if (request.employeeSignature) {
      const employeeSignatureImage = await pdfDoc.embedPng(request.employeeSignature);
      firstPage.drawImage(employeeSignatureImage, {
        x: 530,
        y: height - 580,
        width: 150,
        height: 50,
      });
    } else {
      drawText(`Employee Signature: Not provided`, 50, height - 490);
    }

    // Coordinates for procedures checkboxes
    const procedureCoordinates = {
      'deratizare': 0,
      'dezinsectie': 1,
      'dezinsectie2': 2,
      'dezinfectie': 3,
    };

    console.log(request)

    for (const operation of request.operations) {
      const coordinate = procedureCoordinates[operation.name];

      let yPosition = 365 - coordinate * 22;
      drawText('X', 130, yPosition);

      const surfaceXPosition = 182;
      const solutionXPosition = 250;
      const quantityXPosition = solutionXPosition + 145;
      const concentrationXPosition = quantityXPosition + 140;
      const lotXPosition = concentrationXPosition + 53;

    drawText(`${operation.surface}mp`, surfaceXPosition, yPosition);
    // Afișează DOAR numele substanței, fără (Disponibil...) sau alte detalii
    const solutionName = operation.solution.split(' (Disponibil')[0];
    drawText(solutionName, solutionXPosition, yPosition);
  drawText(`${parseFloat(Number(operation.quantity)).toFixed(2)} ${await fetchSolutionUnitOfMeasure(operation.solutionId)}`, quantityXPosition, yPosition);
      drawText(`${operation.concentration}%`, concentrationXPosition, yPosition);
      drawText(`${operation.lot}`, lotXPosition, yPosition);
    }

    drawText(`${request.observations}`, 190, 160);
    console.log(request.observations);

    // Draw custody items if their values are greater than 0
    const custodyItems = [
      { label: 'Dispozitive profesionale ultrasunete rozatoare', value: request.custodyItems.ultrasuneteRozatoare },
      { label: 'Dispozitive profesionale ultrasunete pasari', value: request.custodyItems.ultrasunetePasari },
      { label: 'Dispozitive profesionale antiinsecte', value: request.custodyItems.antiinsecte },
      { label: 'Dispozitiv mecanic capturare rozatoare', value: request.custodyItems.capturareRozatoare },
      { label: 'Statie de intoxicare exterior', value: request.custodyItems.statieIntoxicare }
    ];

    let xOffset = 220;
    custodyItems.forEach(item => {
      if (item.value > 0) {
        drawText(`${item.label}: ${item.value}`, xOffset, height - 390);
        xOffset =xOffset+ 250;
      }
    });

    // Save the PDF document and return the bytes
    const pdfBytes = await pdfDoc.save();
    console.log('Generated PDF Bytes Length:', pdfBytes.length);
    return pdfBytes;
  } catch (error) {
    console.error('Error filling template:', error);
    throw error;
  }
};
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
    drawText(`${request.client.name}`, 180, height - 180);
    drawText(`${request.client.contract_number}`, 525, height - 180);
    drawText(`${request.client.location}`, 200, height - 202);
    drawText(`${request.client.surface}`, 560, height - 202); // Added Suprafat client

    drawText(` ${request.clientRepresentative}`, 140, height - 520);

    // Embed and draw the client representative's signature
    if (request.clientSignature) {
      const clientSignatureImage = await pdfDoc.embedPng(request.clientSignature);
      firstPage.drawImage(clientSignatureImage, {
        x: 75,
        y: height - 580,
        width: 150,
        height: 50,
      });
    } else {
      drawText(`Client Signature: Not provided`, 580, height - 520);
    }

    // Draw employee information in blue
    const blueGreenColor = rgb(0, 0.1, 0.3);
    drawText(` ${request.employeeName}`, 540, height - 522, blueGreenColor);
    drawText(` ${request.employeeIDSeries}`, 550, height - 532, blueGreenColor); // Add ID series

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
      drawText(`${operation.solution}`, solutionXPosition, yPosition);
      drawText(`${parseFloat(Number(operation.quantity)).toFixed(2)} ${await fetchSolutionUnitOfMeasure(operation.solutionId)}`, quantityXPosition, yPosition);
      drawText(`${operation.concentration}%`, concentrationXPosition, yPosition);
      drawText(`${operation.lot}`, lotXPosition, yPosition);
    }

    drawText(`${request.observations}`, 190, 160);
    console.log(request.observations);

    // Draw custody items if their values are greater than 0
    if (request.custodyItems.ultrasuneteRozatoare > 0) {
      drawText(`Ultrasunete Rozatoare: ${request.custodyItems.ultrasuneteRozatoare}`, 220, height - 390);
    }
    if (request.custodyItems.ultrasunetePasari > 0) {
      drawText(`Ultrasunete Pasari: ${request.custodyItems.ultrasunetePasari}`, 350, height - 390);
    }
    if (request.custodyItems.antiinsecte > 0) {
      drawText(`Antiinsecte: ${request.custodyItems.antiinsecte}`, 455, height - 390);
    }
    if (request.custodyItems.capturareRozatoare > 0) {
      drawText(`Capturare Rozatoare: ${request.custodyItems.capturareRozatoare}`, 525, height - 390);
    }
    if (request.custodyItems.statieIntoxicare > 0) {
      drawText(`Statie Intoxicare: ${request.custodyItems.statieIntoxicare}`, 650, height - 390);
    }

    // Save the PDF document and return the bytes
    const pdfBytes = await pdfDoc.save();
    console.log('Generated PDF Bytes Length:', pdfBytes.length);
    return pdfBytes;
  } catch (error) {
    console.error('Error filling template:', error);
    throw error;
  }
};